import type { Request, Response } from 'express';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { storiesService, type StoryItem } from '../services/stories-service.js';
import { unlink } from 'fs/promises';
import sharp from 'sharp';
import { join } from 'path';

export type StoryData = {
  id: string;
  stories: Array<{
    title: string;
    imageUrl: string;
    storyText?: string;
  }>;
};

function convertStoriesToResponse(stories: StoryItem[]): StoryData['stories'] {
  const response: StoryData['stories'] = [];

  for (const story of stories) {
    if (story.type === 'image' && story.imageUrl) {
      response.push({
        title: story.title,
        imageUrl: story.imageUrl,
      });
    } else if (story.type === 'text') {
      response.push({
        title: story.title,
        imageUrl: '',
        storyText: story.content,
      });
    }
  }

  return response;
}

export const handleStoriesGeneration = async (
  req: Request,
  res: Response
): Promise<void> => {
  // to track file that need to be delete after process done
  const filesToClean: string[] = [];

  try {
    const { purchaseData, imageStyle, gender, traits } = req.body;

    const parsedImageStyle = Array.isArray(imageStyle)
      ? imageStyle
      : typeof imageStyle === 'string'
        ? imageStyle.split(',').map((s) => s.trim())
        : [];

    const parsedTraits = Array.isArray(traits)
      ? traits
      : typeof traits === 'string'
        ? traits.split(',').map((t) => t.trim())
        : [];

    const parsedPurchaseData = Array.isArray(purchaseData)
      ? purchaseData
      : typeof purchaseData === 'string'
        ? JSON.parse(purchaseData)
        : [];

    // Handle uploaded image file (from multer middleware)
    const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
    let imagePath: string | undefined;

    if (uploadedFile) {
      filesToClean.push(uploadedFile.path);

      Logger.info('Processing uploaded image for stories', {
        component: 'stories-handler',
        operation: 'upload-process',
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
      });

      // Resize image to reduce base64 size
      const resizedPath = join(
        'uploads',
        `resized-${Date.now()}-${uploadedFile.originalname}`
      );
      await sharp(uploadedFile.path)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(resizedPath);

      filesToClean.push(resizedPath);
      imagePath = resizedPath;
    }

    const jobId = await storiesService.createGenerationJob(
      parsedPurchaseData,
      parsedImageStyle,
      gender || 'neutral',
      parsedTraits,
      imagePath
    );

    res.json({
      success: true,
      id: jobId,
    });
  } catch (error) {
    Logger.error('Stories generation initiation failed', error as Error, {
      component: 'stories-handler',
      operation: 'generate-stories',
    });
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Stories generation failed. Please try again.',
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up files
    for (const filePath of filesToClean) {
      try {
        await unlink(filePath);
        Logger.debug('Cleaned up temporary file', {
          component: 'stories-handler',
          operation: 'cleanup',
          filePath,
        });
      } catch (error) {
        Logger.warn('Failed to cleanup temporary file', {
          component: 'stories-handler',
          operation: 'cleanup',
          filePath,
          error: (error as Error).message,
        });
      }
    }
  }
};

export const handleStoriesPoll = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const job = await storiesService.getJobStatusWithFallback(id);

  if (!job) {
    res.status(404).json({
      id,
      status: 'not_found',
      progress: 0,
    });
    return;
  }

  res.json({
    id,
    status: job.status,
    progress: job.progress,
    error: job.error,
  });
};

export const handleGetStories = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const stories = await storiesService.getJobResultWithFallback(id);

  if (!stories) {
    const job = await storiesService.getJobStatusWithFallback(id);
    if (!job) {
      res.status(404).json({
        error: 'Story not found',
        id,
      });
      return;
    }

    res.status(202).json({
      id,
      status: job.status,
      progress: job.progress,
      stories: [],
    });
    return;
  }

  res.json({
    id,
    stories: convertStoriesToResponse(stories),
  });
};

export const getStoryData = async (id: string): Promise<StoryData> => {
  const stories = await storiesService.getJobResultWithFallback(id);

  if (stories) {
    return {
      id,
      stories: convertStoriesToResponse(stories),
    };
  }

  return {
    id,
    stories: [
      {
        title: 'Your Purchase Journey',
        imageUrl:
          'https://thumbs.dreamstime.com/b/autumn-colorful-forest-road-nature-landscape-vertical-image-narrow-winding-road-autumn-forest-nature-bright-colorful-landscape-102169317.jpg',
      },
      {
        title: 'Shopping Adventures',
        imageUrl:
          'https://media.istockphoto.com/id/1368628035/photo/brooklyn-bridge-at-sunset.jpg?s=612x612&w=0&k=20&c=hPbMbTYRAVNYWAUMkl6r62fPIjGVJTXzRURCyCfoG08=',
      },
      {
        title: 'Beautiful Purchases',
        imageUrl:
          'https://static.vecteezy.com/system/resources/thumbnails/055/040/907/small_2x/lush-green-tree-on-top-of-cliff-in-mountains-with-sun-rays-vertical-nature-background-generated-by-artificial-intelligence-photo.jpg',
      },
      {
        title: 'Nature-Inspired Shopping',
        imageUrl:
          'https://www.jessleephotos.com/images/xl/teton-overlook-autumn.jpg',
      },
    ],
  };
};
