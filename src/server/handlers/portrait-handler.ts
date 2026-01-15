import { Request, Response } from 'express';
import { promptService } from '../services/prompt-service.js';
import { imageService } from '../services/image-service.js';

export const handlePortraitGeneration = async (req: Request, res: Response) => {
  try {
    const {
      imageStyle,
      gender,
      traits,
      model = 'flux-schnell',
      purchaseData,
    } = req.body;

    console.log(
      `🚀 Portrait generation request: ${imageStyle}, ${gender}, [${traits}], model=${model}`
    );

    // Build prompt using prompt service
    const prompt = await promptService.buildPrompt({
      imageStyle,
      gender,
      traits,
      purchaseData,
    });

    // Generate image using image service
    const imageData = await imageService.generate(prompt, model);

    // Return response in the format expected by frontend
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
  }
};
