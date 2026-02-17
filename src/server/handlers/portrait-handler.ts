import { Request, Response } from 'express';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { imageService } from '../services/image-service.js';
import {
  processUploadedImage,
  type ProcessedImageResult,
} from '../utils/image-processing.js';
import {
  parseArrayField,
  parsePurchaseData,
  parseGender,
} from '../utils/request-parsers.js';
import { cleanupFiles } from '../utils/file-cleanup.js';
import { sendErrorResponse } from '../utils/error-responses.js';

export const handleGeneratePortrait = async (
  req: Request,
  res: Response
): Promise<void> => {
  // to track file that need to be delete after process done
  const filesToClean: string[] = [];

  try {
    const { imageStyle, gender, traits, purchaseData } = req.body;

    const parsedImageStyle = parseArrayField(imageStyle);
    const parsedTraits = parseArrayField(traits);
    const parsedPurchaseData = parsePurchaseData(purchaseData);

    // Handle uploaded image file (from multer middleware)
    const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
    let imagePath: string | undefined;

    if (uploadedFile) {
      const result: ProcessedImageResult = await processUploadedImage(
        uploadedFile.path,
        uploadedFile.originalname,
        { width: 1024, height: 1024, quality: 85, fit: 'inside' },
        {
          component: 'portrait-handler',
          operation: 'upload-process',
          filePath: uploadedFile.path,
        }
      );

      filesToClean.push(...result.cleanupPaths);
      imagePath = result.resizedPath;
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
      parseGender(gender),
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
    sendErrorResponse(res, error, 500, {
      component: 'portrait-handler',
      operation: 'generate-portrait',
    });
  } finally {
    // Clean up files
    await cleanupFiles(filesToClean, {
      component: 'portrait-handler',
      operation: 'cleanup',
    });
  }
};
