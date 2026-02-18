import sharp from 'sharp';
import { join } from 'path';

// Resize an image using Sharp. Returns the path to the resized image.
export async function resizeImage(
  imagePath: string,
  originalName: string
): Promise<string> {
  const resizedPath = join(
    'uploads',
    `resized-${Date.now()}-${originalName}`
  );

  await sharp(imagePath)
    .resize(1024, 1024, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toFile(resizedPath);

  return resizedPath;
}
