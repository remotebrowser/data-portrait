import sharp from 'sharp';
import { join } from 'path';
import { ServerLogger as Logger } from './logger/index.js';

export type ResizeOptions = {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'inside' | 'outside' | 'cover' | 'contain' | 'fill';
};

const DEFAULT_RESIZE_OPTIONS: Required<ResizeOptions> = {
  width: 1024,
  height: 1024,
  quality: 85,
  fit: 'inside',
};

export type ProcessedImageResult = {
  resizedPath: string;
  cleanupPaths: string[];
};

// Process and resize an uploaded image using Sharp.
// Returns the path to the resized image and paths to cleanup.
export async function processUploadedImage(
  imagePath: string,
  originalName: string,
  options: ResizeOptions = {},
  loggerContext: { component: string; operation: string; filePath?: string } = {
    component: 'image-processing',
    operation: 'process',
  }
): Promise<ProcessedImageResult> {
  const opts = { ...DEFAULT_RESIZE_OPTIONS, ...options };

  Logger.info('Processing uploaded image', {
    component: loggerContext.component,
    operation: loggerContext.operation,
    filePath: loggerContext.filePath || imagePath,
  });

  const resizedPath = join(
    'uploads',
    `resized-${Date.now()}-${originalName}`
  );

  await sharp(imagePath)
    .resize(opts.width, opts.height, {
      fit: opts.fit,
      withoutEnlargement: true,
    })
    .jpeg({ quality: opts.quality })
    .toFile(resizedPath);

  return {
    resizedPath,
    cleanupPaths: [imagePath, resizedPath],
  };
}

// Process an image file from a path (for cases where originalName is not available).
export async function processImageFromPath(
  imagePath: string,
  options: ResizeOptions = {},
  loggerContext: { component: string; operation: string } = {
    component: 'image-processing',
    operation: 'process',
  }
): Promise<ProcessedImageResult> {
  const filename = imagePath.split('/').pop() || 'image.jpg';
  return processUploadedImage(imagePath, filename, options, loggerContext);
}
