import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';
import { nanoid } from 'nanoid';
import { gcsService } from './gcs-service.js';
import { localStorageService } from './local-storage-service.js';
import {
  createAIClient,
  MODELS,
  getAvailableProvider,
  type AIImageResponse,
} from '../ai/index.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const BLUR_BACKGROUND_TIMEOUT = 30000;

export type ImageData = {
  url?: string;
  filename?: string;
  fileSize?: number;
  b64_json?: string;
  width?: number;
  height?: number;
  model?: string;
  provider?: string;
};

export type GenerateOptions = {
  beforeSave?: (base64: string) => Promise<string>;
};

/**
 * System prompt for creative prompt generation from purchase data.
 */
const PROMPT_ENGINEERING_SYSTEM = `You are an expert Prompt Engineer specializing in creating compelling AI image generation prompts.

TASK: Analyze the user's purchase history and create a detailed, creative image prompt for a personalized portrait.

INPUT DATA:
- Purchase History: The user's actual purchase data showing brands, products, and categories
- Image Style: The visual aesthetic requested
- Character Details: Gender and physical traits for the portrait subject

OUTPUT: Generate a single image generation prompt (80-120 words) that:
1. Places the user as the main character/subject
2. Creatively incorporates their purchase interests into the scene context
3. Blends their actual brands/products into the environment naturally
4. Uses the specified visual style throughout
5. Includes professional photography details (camera, lens, lighting)
6. Ends with "9:16 vertical portrait orientation"

PROMPT STRUCTURE:
- Subject: Describe the person using gender and traits provided
- Setting: Create a creative environment based on their purchase patterns
- Details: Include subtle references to their brands/products in the scene
- Style: Apply the requested image style to the entire composition
- Technical: Add camera specs and "9:16 vertical portrait orientation"

EXAMPLE:
If user buys coffee and books, don't just say "person with coffee and books" - create a scene like "A person relaxing in a cozy literary café with steaming latte, surrounded by shelves of science fiction novels, warm ambient lighting, Hasselblad X2D, 80mm lens, Kodak film, 9:16 vertical portrait orientation"`;

class ImageService {
  private aiClient = createAIClient();
  private provider = getAvailableProvider();

  private useGCS(): boolean {
    return Boolean(settings.GCS_BUCKET_NAME && settings.GCS_PROJECT_ID);
  }

  async generate(
    prompt: string,
    imagePath?: string,
    options?: GenerateOptions
  ): Promise<ImageData> {
    Logger.info('Starting image generation', {
      component: 'image-service',
      operation: 'generate',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      hasReferenceImage: Boolean(imagePath),
      provider: this.provider,
    });

    const imageBase64 = imagePath
      ? await this.readImageAsBase64(imagePath)
      : undefined;

    const modelConfig = MODELS[this.provider].image;

    const aiResponse: AIImageResponse = await this.aiClient.generateImage({
      prompt,
      imageBase64,
      model: modelConfig.id,
      maxTokens: modelConfig.maxTokens,
      width: 1024,
      height: 1024,
    });

    let finalBase64 = aiResponse.base64;
    if (options?.beforeSave) {
      finalBase64 = await options.beforeSave(finalBase64);
    }

    const fileData = await this.saveImageFile(finalBase64, aiResponse.model);

    return {
      ...fileData,
      b64_json: finalBase64,
      width: aiResponse.width,
      height: aiResponse.height,
      model: aiResponse.model,
      provider: aiResponse.provider,
    };
  }

  /**
   * Generate image from purchase data with LLM-powered dynamic prompt generation.
   * Uses an LLM to analyze purchase data and create a creative, contextual image prompt.
   */
  async generateFromPurchase(
    purchaseData: unknown[],
    imageStyle: string[],
    gender: string,
    traits: string[],
    imagePath?: string
  ): Promise<ImageData> {
    Logger.info('Starting image generation from purchase data', {
      component: 'image-service',
      operation: 'generateFromPurchase',
      purchaseCount: purchaseData.length,
      styles: imageStyle,
      hasReferenceImage: Boolean(imagePath),
    });

    const prompt = await this.buildCreativePrompt({
      purchaseData,
      imageStyle,
      gender,
      traits,
    });

    Logger.debug('LLM-generated prompt from purchase data', {
      component: 'image-service',
      operation: 'generateFromPurchase',
      promptLength: prompt.length,
    });

    return this.generate(prompt, imagePath);
  }

  private async buildCreativePrompt({
    purchaseData,
    imageStyle,
    gender,
    traits,
  }: {
    purchaseData: unknown[];
    imageStyle: string[];
    gender: string;
    traits: string[];
  }): Promise<string> {
    const userContent = `Create an image generation prompt based on this data:

Purchase History: ${JSON.stringify(purchaseData)}
Image Style: ${imageStyle.join(', ')}
Gender: ${gender}
Traits: ${traits.join(', ')}

Generate only the image prompt text, nothing else.`;

    const textModel = MODELS[this.provider].text;

    const aiResponse = await this.aiClient.generateText({
      systemPrompt: PROMPT_ENGINEERING_SYSTEM,
      prompt: userContent,
      model: textModel.id,
      maxTokens: textModel.maxTokens,
    });

    if (!aiResponse.text || aiResponse.text.length === 0) {
      throw new Error('Failed to generate prompt from LLM');
    }

    return aiResponse.text;
  }

  async blurBackground(imageBase64: string): Promise<ImageData> {
    if (!settings.DEEPINFRA_API_KEY) {
      throw new Error('DEEPINFRA_API_KEY not configured');
    }

    console.log('🔘 Applying background blur via DeepInfra Bria API...');

    const response = await Promise.race([
      fetch(
        'https://api.deepinfra.com/v1/inference/Bria/blur_background?version=0ObxGWB8',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.DEEPINFRA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: `data:image/png;base64,${imageBase64}`,
            scale: 5,
          }),
        }
      ),
      this.createTimeoutPromise(BLUR_BACKGROUND_TIMEOUT),
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepInfra API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as { images: string[] };

    if (!Array.isArray(data.images) || data.images.length < 1) {
      throw new Error('No blurred image URL returned from DeepInfra API');
    }

    const imageUrl = data.images[0];
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const blurredBase64 = Buffer.from(imageBuffer).toString('base64');
    const fileData = await this.saveImageFile(blurredBase64, 'bria-blur');

    console.log('✅ Background blur applied successfully');

    return {
      ...fileData,
      b64_json: blurredBase64,
      width: 1024,
      height: 1024,
      model: 'bria-blur',
      provider: 'deepinfra',
    };
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
