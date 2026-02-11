import { Request, Response } from 'express';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { imageService } from '../services/image-service.js';
import { unlink } from 'fs/promises';
import sharp from 'sharp';
import { join } from 'path';

export const handleGeneratePortrait = async (
  req: Request,
  res: Response
): Promise<void> => {
  // to track file that need to be delete after process done
  const filesToClean: string[] = [];

  try {
    const { imageStyle, gender, traits, purchaseData } = req.body;

    const parsedImageStyle = Array.isArray(imageStyle)
      ? imageStyle
      : typeof imageStyle === 'string' && imageStyle.length > 0
        ? imageStyle.split(',').map((s) => s.trim())
        : [];

    const parsedTraits = Array.isArray(traits)
      ? traits
      : typeof traits === 'string' && traits.length > 0
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

      Logger.info('Processing uploaded image', {
        component: 'portrait-handler',
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

    Logger.info('Starting generate-from-purchase', {
      component: 'portrait-handler',
      operation: 'generate-from-purchase',
      purchaseCount: parsedPurchaseData.length,
      styleCount: parsedImageStyle.length,
      traitCount: parsedTraits.length,
      hasReferenceImage: Boolean(imagePath),
    });

    const imageData = await imageService.generateFromPurchase(
      parsedPurchaseData,
      parsedImageStyle,
      gender || '',
      parsedTraits,
      imagePath
    );

    const hasBackgroundBlur = parsedTraits.includes('background-blur');
    if (hasBackgroundBlur && imageData.b64_json) {
      Logger.info('Background blur trait detected - applying blur', {
        component: 'portrait-handler',
        operation: 'blur-background',
      });
      try {
        const blurredImageData = await imageService.blurBackground(
          imageData.b64_json
        );
        Object.assign(imageData, blurredImageData);
      } catch (blurError) {
        Logger.warn('Background blur failed, returning original image', {
          component: 'portrait-handler',
          operation: 'blur-background',
          error: blurError instanceof Error ? blurError.message : 'Unknown',
        });
      }
    }

    res.json({
      success: true,
      image: {
        url: imageData.url,
        filename: imageData.filename,
        fileSize: imageData.fileSize,
        width: imageData.width,
        height: imageData.height,
      },
      model: imageData.model,
      provider: imageData.provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Portrait generation failed', error as Error, {
      component: 'portrait-handler',
      operation: 'generate-portrait',
    });
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Portrait generation failed. Please try again.',
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up files
    for (const filePath of filesToClean) {
      try {
        await unlink(filePath);
        Logger.debug('Cleaned up temporary file', {
          component: 'portrait-handler',
          operation: 'cleanup',
          filePath,
        });
      } catch (error) {
        Logger.warn('Failed to cleanup temporary file', {
          component: 'portrait-handler',
          operation: 'cleanup',
          filePath,
          error: (error as Error).message,
        });
      }
    }
  }
};
