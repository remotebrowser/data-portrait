import { Portkey } from 'portkey-ai';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';
import { imageService } from './image-service.js';
import { gcsService, type StoryMetadata } from './gcs-service.js';
import { promptService } from './prompt-service.js';
import { nanoid } from 'nanoid';
import { unlink } from 'fs/promises';
import sharp from 'sharp';
import { join } from 'path';

const portkey = new Portkey({
  apiKey: settings.PORTKEY_API_KEY,
});

type StoryItem = {
  type: 'image' | 'text';
  title: string;
  content: string;
  imageUrl?: string;
  filename?: string;
};

type StoryChapter = {
  title: string;
  imagePrompt: string;
  storyText: string;
};

type GenerationJob = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progress: number;
  stories: StoryItem[];
  error?: string;
};

const generationJobs = new Map<string, GenerationJob>();

const STORY_LINK_OVERLAY_TEXT = 'dataportrait.app';

function hasGCSConfig(): boolean {
  return Boolean(settings.GCS_BUCKET_NAME && settings.GCS_PROJECT_ID);
}

function storyItemsToMetadata(
  jobId: string,
  stories: StoryItem[]
): StoryMetadata {
  return {
    id: jobId,
    createdAt: new Date().toISOString(),
    stories: stories.map((story) => ({
      type: story.type,
      title: story.title,
      content: story.content,
      imageUrl: story.imageUrl,
      filename: story.filename,
    })),
  };
}

function metadataToStoryItems(metadata: StoryMetadata): StoryItem[] {
  return metadata.stories.map((story) => ({
    type: story.type,
    title: story.title,
    content: story.content,
    imageUrl: story.imageUrl,
    filename: story.filename,
  }));
}

const SYSTEM_PROMPT = `You are a Data Analyst creating visual stories from user data.

TASK: Create a 2-chapter visual journey by analyzing the user history:
1. Identify patterns across different brands and categories in the user's timeline.
2. Create 2 chapters that flow narratively from one to the next.
3. For each chapter, generate:
   - A compelling title (3-5 words)
   - An 80-100 word image prompt blending dominant brand(s) with user interests
   - A 2-4 line story with stats

IMAGE PROMPT RULES:
- Order: Subject + Action + Style + Context
- Blend brand elements into creative contexts (e.g., coffee shop in fantasy setting, bookstore in sci-fi world)
- Aesthetics: Specify camera (Hasselblad/Sony), lens (35mm/85mm), and film stock (Kodak/Fujifilm)
- Subject: The user themselves as the main character (not a generic traveler)
- Aspect Ratio: Always end each prompt with '9:16 vertical portrait orientation'
- Character: Use the provided character description to personalize the protagonist

STORY FORMAT:
- Short, punchy lines optimized for image overlay
- Include specific stats/counts from the data (e.g., '3 purchases', '4 visits', '5 items')
- Tell a brief journey across the year
- Use emojis and engaging voice
- Max 4 lines, 2-3 lines ideal
- Examples:
  "You explored 3 new worlds this winter.  ✨
  Fueled by 4 coffee stops, a cosmic year begins."

  "5 discoveries, 2 brand adventures.  
  Summer was pure magic."

CONTINUITY RULES:
- Chapter 2's story must logically continue from Chapter 1's story
- Maintain consistent character progression
- Each image prompt should reflect the current story state and character appearance`;

async function generateStoryChapters(
  purchaseData: unknown[],
  imageStyle: string[],
  gender: string,
  traits: string[]
): Promise<StoryChapter[]> {
  // Build character description for the story
  const characterPrompt = await promptService.buildPrompt({
    imageStyle,
    gender,
    traits,
    purchaseData,
  });

  const userContent = `User Purchase History: ${JSON.stringify(purchaseData)}
Character Description: ${characterPrompt}

Analyze this complete purchase data and create a 2-chapter visual story featuring this specific character as the protagonist. Focus on patterns across all brands and product categories to create a comprehensive narrative.`;

  const response = await portkey.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    model: '@OpenRouter/google/gemini-2.5-pro-preview',
    max_tokens: 8192,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'story_chapters',
        description: 'Array of story chapters',
        strict: true,
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Chapter title (3-5 words)',
              },
              imagePrompt: {
                type: 'string',
                description: 'Image prompt (80-100 words)',
              },
              storyText: {
                type: 'string',
                description: 'Story text (2-4 lines)',
              },
            },
            required: ['title', 'imagePrompt', 'storyText'],
          },
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content =
    typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
  const parsedData: unknown = JSON.parse(content);

  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    throw new Error('Invalid chapters format received');
  }

  const chapters: StoryChapter[] = [];
  for (const item of parsedData) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'title' in item &&
      'imagePrompt' in item &&
      'storyText' in item &&
      typeof (item as Record<string, unknown>).title === 'string' &&
      typeof (item as Record<string, unknown>).imagePrompt === 'string' &&
      typeof (item as Record<string, unknown>).storyText === 'string'
    ) {
      chapters.push({
        title: String((item as Record<string, unknown>).title),
        imagePrompt: String((item as Record<string, unknown>).imagePrompt),
        storyText: String((item as Record<string, unknown>).storyText),
      });
    }
  }

  if (chapters.length === 0) {
    throw new Error('No valid chapters found in response');
  }

  return chapters;
}

class StoriesService {
  async createGenerationJob(
    purchaseData: unknown[],
    imageStyle: string[],
    gender: string,
    traits: string[],
    imagePath?: string
  ): Promise<string> {
    const jobId = nanoid(16);

    generationJobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0,
      stories: [],
    });

    this.processGenerationJob(
      jobId,
      purchaseData,
      imageStyle,
      gender,
      traits,
      imagePath
    ).catch((error) => {
      Logger.error('Story generation job failed', error as Error, {
        component: 'stories-service',
        operation: 'process-generation-job',
        jobId,
      });
      const job = generationJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
      }
    });

    return jobId;
  }

  private async processGenerationJob(
    jobId: string,
    purchaseData: unknown[],
    imageStyle: string[],
    gender: string,
    traits: string[],
    imagePath?: string
  ): Promise<void> {
    const job = generationJobs.get(jobId);
    if (!job) return;

    job.status = 'generating';

    const cleanupPaths: string[] = [];
    let resizedImagePath: string | undefined;

    if (imagePath) {
      Logger.info('Processing uploaded image for stories', {
        component: 'stories-service',
        operation: 'upload-process',
        filePath: imagePath,
      });

      const resizedPath = join(
        'uploads',
        `resized-${Date.now()}-${imagePath.split('/').pop()}`
      );

      await sharp(imagePath)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(resizedPath);

      cleanupPaths.push(imagePath, resizedPath);
      resizedImagePath = resizedPath;
    }

    try {
      const chapters = await generateStoryChapters(
        purchaseData,
        imageStyle,
        gender,
        traits
      );
      const stories: StoryItem[] = [];

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];

        job.progress = Math.round(((i * 2) / (chapters.length * 2)) * 100);

        const imageData = await imageService.generate(
          chapter.imagePrompt,
          resizedImagePath,
          {
            beforeSave: addStoryLinkOverlay,
          }
        );

        stories.push({
          type: 'image',
          title: chapter.title,
          content: chapter.imagePrompt,
          imageUrl: imageData.url || '',
          filename: imageData.filename,
        });

        stories.push({
          type: 'text',
          title: chapter.title,
          content: chapter.storyText,
        });

        job.progress = Math.round(((i * 2 + 1) / (chapters.length * 2)) * 100);
      }

      job.stories = stories;
      job.status = 'completed';
      job.progress = 100;

      if (hasGCSConfig()) {
        try {
          const metadata = storyItemsToMetadata(jobId, stories);
          await gcsService.uploadMetadata(metadata);
        } catch (error) {
          Logger.error('Failed to persist story metadata', error as Error, {
            component: 'stories-service',
            operation: 'persist-metadata',
            jobId,
          });
        }
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Generation failed';
      throw error;
    } finally {
      if (cleanupPaths.length) {
        const cleanupDelayMs = 90_000;
        setTimeout(async () => {
          for (const filePath of cleanupPaths) {
            try {
              await unlink(filePath);
              Logger.debug('Cleaned up temporary file', {
                component: 'stories-service',
                operation: 'cleanup',
                filePath,
              });
            } catch (cleanupError) {
              Logger.warn('Failed to cleanup temporary file', {
                component: 'stories-service',
                operation: 'cleanup',
                filePath,
                error:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : 'Unknown error',
              });
            }
          }
        }, cleanupDelayMs);
      }
    }
  }

  getJobStatus(jobId: string): GenerationJob | undefined {
    const inMemoryJob = generationJobs.get(jobId);
    if (inMemoryJob) {
      return inMemoryJob;
    }

    return undefined;
  }

  async getJobStatusWithFallback(
    jobId: string
  ): Promise<GenerationJob | undefined> {
    const inMemoryJob = generationJobs.get(jobId);
    if (inMemoryJob) {
      return inMemoryJob;
    }

    if (hasGCSConfig()) {
      const metadata = await gcsService.downloadMetadata(jobId);
      if (metadata) {
        return {
          id: jobId,
          status: 'completed',
          progress: 100,
          stories: metadataToStoryItems(metadata),
        };
      }
    }

    return undefined;
  }

  getJobResult(jobId: string): StoryItem[] | undefined {
    const job = generationJobs.get(jobId);
    if (job?.status === 'completed') {
      return job.stories;
    }
    return undefined;
  }

  async getJobResultWithFallback(
    jobId: string
  ): Promise<StoryItem[] | undefined> {
    const inMemoryResult = this.getJobResult(jobId);
    if (inMemoryResult) {
      return inMemoryResult;
    }

    if (hasGCSConfig()) {
      const metadata = await gcsService.downloadMetadata(jobId);
      if (metadata) {
        return metadataToStoryItems(metadata);
      }
    }

    return undefined;
  }

  cleanupJob(jobId: string): void {
    generationJobs.delete(jobId);
  }
}

/**
 * Add dataportrait.app link text overlay to base64 image data.
 * Renders text at bottom-right with white fill and black border, same manner as a watermark.
 * Returns image as base64 string.
 */
export async function addStoryLinkOverlay(imageData: string): Promise<string> {
  const imageBuffer = Buffer.from(imageData, 'base64');
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  const padding = 20;
  const text = STORY_LINK_OVERLAY_TEXT;
  const baseOverlayHeight = Math.round(Math.min(width, height) * 0.06);
  const fontSize = Math.round(baseOverlayHeight * 0.7);
  const rectHorizontalPadding = 6;
  const estimatedTextWidth = Math.round(fontSize * text.length * 0.45);
  const rectWidth = Math.min(
    Math.round(width * 0.8),
    estimatedTextWidth + rectHorizontalPadding * 2
  );
  const overlayWidth = rectWidth;
  const overlayHeight = baseOverlayHeight;
  const svg =
    `<svg width="${overlayWidth}" height="${overlayHeight}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="0" width="${rectWidth}" height="${overlayHeight}" rx="8" ry="8" fill="white"/>` +
    `<text x="${rectWidth - rectHorizontalPadding}" y="${overlayHeight - 10}" text-anchor="end"` +
    ` font-family="Arial, sans-serif" font-size="${fontSize}" fill="black" dominant-baseline="baseline">` +
    `${text}</text></svg>`;

  const textOverlay = await sharp(Buffer.from(svg)).png().toBuffer();

  const left = width - overlayWidth - padding;
  const top = height - overlayHeight - padding;

  const resultBuffer = await image
    .composite([
      {
        input: textOverlay,
        left,
        top,
      },
    ])
    .png()
    .toBuffer();

  return resultBuffer.toString('base64');
}

export const storiesService = new StoriesService();
export type { StoryItem, GenerationJob };
