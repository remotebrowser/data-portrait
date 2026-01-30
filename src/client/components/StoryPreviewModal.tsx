import { useEffect, useMemo, useState } from 'react';
import Stories from 'react-insta-stories';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { SocialShareButtons } from './SocialShareButtons.js';
import type { GeneratedImage } from '../modules/PortraitGeneration.js';
import type { Story } from 'react-insta-stories/dist/interfaces.js';

type StoryPreviewModalProps = {
  story: GeneratedImage | null;
  onClose: () => void;
};

export function StoryPreviewModal({ story, onClose }: StoryPreviewModalProps) {
  const images = story?.images;
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const stories: Story[] = useMemo(
    () =>
      images?.map((image) => ({
        url: image.url,
        duration: 5000,
        header: {
          heading: 'Your Data Portrait',
          subheading: image.filename || '',
          profileImage: '',
        },
      })) ?? [],
    [images]
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDownloadCurrent = () => {
    const currentImage = images?.[currentStoryIndex];
    if (currentImage) {
      window.open(currentImage.url, '_blank');
    }
  };

  const getShareUrl = (): string | null => {
    if (!story?.id) return null;
    return `${window.location.origin}/shared/stories/${story.id}`;
  };

  const shareUrl = getShareUrl();

  if (!images || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-md w-full h-[90vh] flex flex-col items-center justify-center">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-6 right-4 z-[1000] text-white hover:bg-white/90 hover:text-black rounded-full p-2.5 transition-all duration-200 hover:ring-2 hover:ring-white/50 hover:scale-105 active:scale-95"
        >
          <X className="h-5 w-5 stroke-[2.5]" />
        </Button>

        {/* Stories Container */}
        <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
          <Stories
            stories={stories}
            defaultInterval={5000}
            width="100%"
            height="100%"
            keyboardNavigation
            onAllStoriesEnd={onClose}
            onStoryStart={setCurrentStoryIndex}
            storyContainerStyles={{
              borderRadius: '12px',
              overflow: 'hidden',
            }}
            storyStyles={{
              width: '100dvw',
              maxWidth: '100%',
              margin: 0,
            }}
          />
        </div>

        {/* Action buttons */}
        <div className="absolute bottom-4 right-4 z-[999] flex gap-2 items-center">
          {shareUrl && <SocialShareButtons url={shareUrl} />}

          {/* Download current story button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadCurrent();
            }}
            className="text-white hover:bg-white/90 hover:text-black rounded-full p-2.5 transition-all duration-200 hover:ring-2 hover:ring-white/50 hover:scale-105 active:scale-95"
            title="Download current story"
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
