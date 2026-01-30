import { useState } from 'react';
import type { ImageData } from '../modules/PortraitGeneration.js';

type ImageStackProps = {
  images: ImageData[];
  onClick?: () => void;
};

export function ImageStack({ images, onClick }: ImageStackProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
    setErrorImages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const handleImageError = (index: number) => {
    setErrorImages((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
    setLoadedImages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const SPREAD_OFFSET = 8;
  const MAX_ROTATION = 3;

  if (images.length === 0) {
    return null;
  }

  return (
    <div
      className="aspect-square relative w-full h-full cursor-pointer rounded-lg bg-gray-50 p-2"
      onClick={onClick}
    >
      {images.map((image, index) => {
        const isLoaded = loadedImages.has(index);
        const hasError = errorImages.has(index);

        // First image (index 0) is on top with highest zIndex
        // Subsequent images are stacked below with lower zIndex
        const zIndex = 50 - index * 10;

        // Alternate horizontal direction: even index go right, odd go left
        // This creates a fanning effect spreading both directions
        const horizontalDirection = index % 2 === 0 ? 1 : -1;
        const offsetX = horizontalDirection * index * SPREAD_OFFSET;
        const offsetY = index * SPREAD_OFFSET * 0.4;

        // Rotation alternates based on horizontal direction for natural fanning
        const rotation =
          horizontalDirection * Math.min(index * 1.0, MAX_ROTATION);
        const shadowIntensity = Math.min(index * 0.2, 0.5);

        return (
          <div
            key={`stack-${image.url}-${index}`}
            className="absolute inset-2 transition-all duration-300 hover:scale-[1.02]"
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
              zIndex,
            }}
          >
            {!isLoaded && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                <div className="spinner"></div>
              </div>
            )}

            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-gray-400 text-xs">Failed to load</div>
              </div>
            )}

            <img
              src={image.url}
              alt={image.filename || `Story image ${index + 1}`}
              className={`w-full h-full object-cover rounded-lg ${
                isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-300`}
              style={{
                boxShadow: `0 ${6 + shadowIntensity * 6}px ${12 + shadowIntensity * 12}px rgba(0, 0, 0, ${0.2 + shadowIntensity})`,
              }}
              onLoad={() => handleImageLoad(index)}
              onError={() => handleImageError(index)}
            />
          </div>
        );
      })}
    </div>
  );
}
