import { Portkey } from 'portkey-ai';
import { GoogleGenAI, Modality } from '@google/genai';
import { settings } from '../config.js';
import { nanoid } from 'nanoid';
import { gcsService } from './gcs-service.js';
import { localStorageService } from './local-storage-service.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const portkey = new Portkey({
  apiKey: settings.PORTKEY_API_KEY,
});

const genAI = new GoogleGenAI({ apiKey: settings.GEMINI_API_KEY });

const IMAGE_GENERATION_TIMEOUT = 120000;
const BLUR_BACKGROUND_TIMEOUT = 30000;

type ImageProvider = 'portkey' | 'google-genai';

interface ImageData {
  url?: string;
  filename?: string;
  fileSize?: number;
  b64_json?: string;
  width?: number;
  height?: number;
  model?: string;
  provider?: string;
}

interface DeepInfraResponse {
  created: number;
  data: Array<{
    b64_json: string;
  }>;
}

function getImageProvider(): ImageProvider {
  if (settings.PORTKEY_API_KEY) {
    return 'portkey';
  }
  if (settings.GEMINI_API_KEY) {
    return 'google-genai';
  }
  throw new Error(
    'No image generation provider configured. Please set either PORTKEY_API_KEY or GEMINI_API_KEY in environment variables.'
  );
}

class ImageService {
  private useGCS(): boolean {
    return Boolean(settings.GCS_BUCKET_NAME && settings.GCS_PROJECT_ID);
  }

  async generate(prompt: string, imagePath?: string): Promise<ImageData> {
    console.log(`🎨 Final prompt: "${prompt}"`);
    if (imagePath) {
      console.log(`🖼️ Using reference image: ${imagePath}`);
    }

    const provider = getImageProvider();
    console.log(`🔧 Using image provider: ${provider}`);

    const imageData =
      provider === 'portkey'
        ? await this.generateWithPortkey(prompt, imagePath)
        : await this.generateWithGoogleGenAI(prompt, imagePath);

    return {
      ...imageData,
      model: 'gemini-3-pro-image-preview',
      provider,
    };
  }

  private async generateWithPortkey(
    prompt: string,
    imagePath?: string
  ): Promise<ImageData> {
    if (!settings.PORTKEY_API_KEY) {
      throw new Error('PORTKEY_API_KEY not configured');
    }

    const content: Array<
      | { type: string; text: string }
      | { type: string; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text: prompt,
      },
    ];

    if (imagePath) {
      const imageBase64 = await this.readImageAsBase64(imagePath);
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
        },
      });
    }

    const response = await Promise.race([
      portkey.chat.completions.create({
        model: '@google/gemini-3-pro-image-preview',
        maxTokens: 32000,
        stream: false,
        modalities: ['text', 'image'],
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      }),
      this.createTimeoutPromise(IMAGE_GENERATION_TIMEOUT),
    ]);

    const imageUrl =
      response.choices[0]?.message?.content_blocks?.[0]?.image_url?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from Portkey API');
    }

    const base64Data = imageUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('No image data returned from Portkey API');
    }

    const fileData = await this.saveImageFile(base64Data, 'gemini');
    return {
      ...fileData,
      b64_json: base64Data,
      width: 1024,
      height: 1024,
    };
  }

  private async generateWithGoogleGenAI(
    prompt: string,
    imagePath?: string
  ): Promise<ImageData> {
    if (!settings.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const model = 'gemini-3-pro-image-preview';
    let contents: {
      role: string;
      parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      >;
    } = { role: 'user', parts: [{ text: prompt }] };

    if (imagePath) {
      const imageBase64 = await this.readImageAsBase64(imagePath);
      contents = {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      };
    }

    const geminiGenerationPromise = genAI.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const response = (await Promise.race([
      geminiGenerationPromise,
      this.createTimeoutPromise(IMAGE_GENERATION_TIMEOUT),
    ])) as Awaited<typeof geminiGenerationPromise>;

    if (!response.candidates?.length) {
      throw new Error('No candidates found in Gemini response');
    }

    const candidate = response.candidates[0];
    if (!candidate.content?.parts) {
      throw new Error('No content parts found in Gemini response');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        const fileData = await this.saveImageFile(
          part.inlineData.data,
          'gemini'
        );
        return {
          ...fileData,
          b64_json: part.inlineData.data,
          width: 1024,
          height: 1024,
        };
      }
    }

    throw new Error('No image data found in Gemini response');
  }

  async blurBackground(imageBase64: string): Promise<string> {
    if (!settings.DEEPINFRA_API_KEY) {
      throw new Error('DEEPINFRA_API_KEY not configured');
    }

    console.log('🔘 Applying background blur via DeepInfra Bria API...');

    const response = await Promise.race([
      fetch('https://api.deepinfra.com/v1/openai/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.DEEPINFRA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'Bria/blur_background',
          image: imageBase64,
          n: 1,
        }),
      }),
      this.createTimeoutPromise(BLUR_BACKGROUND_TIMEOUT),
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepInfra API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as DeepInfraResponse;

    if (!data.data || !data.data[0]?.b64_json) {
      throw new Error('No blurred image data returned from DeepInfra API');
    }

    console.log('✅ Background blur applied successfully');
    return data.data[0].b64_json;
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Image generation timed out after ${timeoutMs / 1000} seconds. Please try again later.`
          )
        );
      }, timeoutMs);
    });
  }

  private async saveImageFile(base64Data: string, model: string) {
    const id = nanoid(8);
    const filename = `${model}-portrait-${id}.png`;

    const result = this.useGCS()
      ? await gcsService.uploadImage(base64Data, filename)
      : await localStorageService.uploadImage(base64Data, filename);

    return result;
  }

  private async readImageAsBase64(imagePath: string): Promise<string> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const absolutePath = imagePath.startsWith('/')
      ? imagePath
      : join(__dirname, '../../..', imagePath);

    const imageBuffer = await readFile(absolutePath);
    return imageBuffer.toString('base64');
  }
}

export const imageService = new ImageService();
