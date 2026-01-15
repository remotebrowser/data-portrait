import { GoogleGenAI, Modality } from '@google/genai';
import { settings } from '../config.js';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs';
import * as path from 'node:path';

const genAI = new GoogleGenAI({ apiKey: settings.GEMINI_API_KEY });

const IMAGE_GENERATION_TIMEOUT = 20000;
const IMAGE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const IMAGE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

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
  async generate(prompt: string): Promise<ImageData> {
    console.log(`🎨 Final prompt: "${prompt}"`);

    const imageData = await this.generateWithGemini(prompt);
    return {
      ...imageData,
      model: 'gemini-2.0-flash-preview-image-generation',
      provider: 'google-ai',
    };
  }

  private async generateWithGemini(prompt: string): Promise<ImageData> {
    if (!settings.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const model = 'gemini-2.0-flash-preview-image-generation';
    const geminiGenerationPromise = genAI.models.generateContent({
      model,
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
        const fileData = this.saveImageFile(part.inlineData.data, 'gemini');
        const imageData = {
          ...fileData,
          b64_json: part.inlineData.data,
          width: 1024,
          height: 1024,
        };

        await new Promise((resolve) => setTimeout(resolve, 1000));
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

  private saveImageFile(base64Data: string, model: string) {
    const id = nanoid(8);
    const filename = `${model}-portrait-${id}.png`;
    const publicPath = path.join(process.cwd(), 'public', filename);

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(publicPath, buffer);

    console.log(`💾 ${model} image saved: /${filename}`);

    return {
      url: `/${filename}`,
      filename,
      fileSize: buffer.length,
    };
  }

  cleanupOldImages() {
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) return;

    const now = Date.now();

    try {
      const files = fs.readdirSync(publicDir);
      files.forEach((file) => {
        if (file.includes('-portrait-')) {
          const filePath = path.join(publicDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > IMAGE_MAX_AGE) {
            fs.unlinkSync(filePath);
            console.log('🗑️ Cleaned up old image:', file);
          }
        }
      });
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old images:', error);
    }
  }

  initializeImageCleanup() {
    setInterval(() => this.cleanupOldImages(), IMAGE_CLEANUP_INTERVAL);
    this.cleanupOldImages();
  }
}

export const imageService = new ImageService();
