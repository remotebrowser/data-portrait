import { Request, Response } from 'express';
import { promptService } from '../services/prompt-service.js';
import { imageService } from '../services/image-service.js';
import { unlink } from 'fs/promises';

export const handlePortraitGeneration = async (
  req: Request,
  res: Response
): Promise<void> => {
  let uploadedFilePath: string | undefined;

  try {
    const { imageStyle, gender, traits, purchaseData } = req.body;
    const uploadedFile = req.file;

    if (uploadedFile) {
      uploadedFilePath = uploadedFile.path;

      console.log('🖼️ Uploaded image:', {
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        path: uploadedFilePath,
      });
    }

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

    const prompt = await promptService.buildPrompt({
      imageStyle,
      gender,
      traits: parsedTraits,
      purchaseData: parsedPurchaseData,
    });

    const imageData = await imageService.generate(prompt, uploadedFilePath);

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
    console.error('❌ Portrait generation failed:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Portrait generation failed. Please try again.',
      timestamp: new Date().toISOString(),
    });
  } finally {
    if (uploadedFilePath) {
      try {
        await unlink(uploadedFilePath);
        console.log('🗑️ Cleaned up uploaded file:', uploadedFilePath);
      } catch (error) {
        console.warn('⚠️ Failed to cleanup uploaded file:', error);
      }
    }
  }
};
