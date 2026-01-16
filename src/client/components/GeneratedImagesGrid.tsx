import { Card, CardContent } from '@/components/ui/card.js';
import { Image } from '@/components/ui/image.js';
import { Badge } from '@/components/ui/badge.js';
import { IMAGE_STYLES } from '../modules/ImageStyle.js';

export type ImageData = {
  url: string;
  model?: string;
  provider?: string;
  timestamp: string;
  filename?: string;
  style?: string[];
};

type GeneratedImagesGridProps = {
  generatedImages: ImageData[];
  isGenerating: boolean;
  selectedImageStyle?: string[];
  onImageClick: (imageUrl: string) => void;
};

export function GeneratedImagesGrid({
  generatedImages,
  isGenerating,
  selectedImageStyle,
  onImageClick,
}: GeneratedImagesGridProps) {
  const primarySelectedStyleId = selectedImageStyle?.[0];
  const selectedStyle = IMAGE_STYLES.find(
    (style) => style.id === primarySelectedStyleId
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {/* Show shimmer while generating */}
      {isGenerating && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="aspect-square bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50 animate-pulse"></div>

              {/* Style Badge */}
              {selectedStyle && (
                <div className="absolute bottom-3 left-3 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 shadow-sm"
                  >
                    <span className="mr-1">{selectedStyle.preview}</span>
                    {selectedStyle.name}
                  </Badge>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-400 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="spinner"></div>
                    Generating...
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Images */}
      {generatedImages.map((imageData, i) => {
        const imagePrimaryStyleId = imageData.style?.[0];
        const imageStyle = IMAGE_STYLES.find(
          (style) => style.id === imagePrimaryStyleId
        );

        return (
          <Card
            key={`generated-${imageData.url}-${i}`}
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow relative"
          >
            <CardContent className="p-0 relative">
              {/* Style Badge for generated images - shows the actual style used for this image */}
              {imageStyle && (
                <div className="absolute bottom-3 left-3 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 shadow-sm text-xs"
                  >
                    <span className="mr-1">{imageStyle.preview}</span>
                    {imageStyle.name}
                  </Badge>
                </div>
              )}

              <Image
                imageUrl={imageData.url}
                showBadge={i === 0}
                onClick={() => onImageClick(imageData.url)}
                key={imageData.url}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
