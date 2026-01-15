import Together from 'together-ai';
import { GoogleGenAI, Modality } from '@google/genai';
import { settings } from '../config.js';
import { nanoid } from 'nanoid';
import { gcsService } from './gcs-service.js';

const together = new Together({ apiKey: settings.TOGETHER_API_KEY });
const genAI = new GoogleGenAI({ apiKey: settings.GEMINI_API_KEY });

const IMAGE_GENERATION_TIMEOUT = 20000;

const MODEL_CONFIG = {
  'flux-schnell': {
    provider: 'together',
    model: 'black-forest-labs/FLUX.1-schnell-Free',
  },
  gemini: {
    provider: 'google-ai',
    model: 'gemini-2.0-flash-preview-image-generation',
  },
};

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

class ImageService {
  async generate(
    prompt: string,
    modelName: string = 'flux-schnell'
  ): Promise<ImageData> {
    const config =
      MODEL_CONFIG[modelName as keyof typeof MODEL_CONFIG] ||
      MODEL_CONFIG['flux-schnell'];

    console.log(`🎨 Final prompt: "${prompt}"`);

    let imageData: ImageData;
    if (config.provider === 'together') {
      imageData = await this.generateWithTogether(prompt, config);
    } else if (config.provider === 'google-ai') {
      imageData = await this.generateWithGemini(prompt, config);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    return {
      ...imageData,
      model: config.model,
      provider: config.provider,
    };
  }

  private async generateWithTogether(
    prompt: string,
    config: any
  ): Promise<ImageData> {
    const imageGenerationPromise = together.images.create({
      model: config.model,
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
    });

    const response = (await Promise.race([
      imageGenerationPromise,
      this.createTimeoutPromise(IMAGE_GENERATION_TIMEOUT),
    ])) as Awaited<typeof imageGenerationPromise>;

    const originalData = response.data[0];
    if (originalData.b64_json) {
      const fileData = await this.saveImageFile(originalData.b64_json, 'flux');
      return { ...originalData, ...fileData };
    }
    return originalData;
  }

  private async generateWithGemini(
    prompt: string,
    config: any
  ): Promise<ImageData> {
    if (!settings.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const geminiGenerationPromise = genAI.models.generateContent({
      model: config.model,
      contents: prompt,
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
        const imageData = {
          ...fileData,
          b64_json: part.inlineData.data,
          width: 1024,
          height: 1024,
        };

        return imageData;
      }
    }

    throw new Error('No image data found in Gemini response');
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

    const result = await gcsService.uploadImage(base64Data, filename);

    console.log(`💾 ${model} image uploaded: ${result.url}`);

    return result;
  }
}

export const imageService = new ImageService();
