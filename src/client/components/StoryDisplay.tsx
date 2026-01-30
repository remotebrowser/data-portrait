import { useState, useMemo } from 'react';
import Stories from 'react-insta-stories';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { SocialShareButtons } from './SocialShareButtons.js';
import type { GeneratedImage } from '../modules/PortraitGeneration.js';
import type { Story } from 'react-insta-stories/dist/interfaces.js';

const StoriesComponent = Stories as unknown as React.ComponentType<{
  stories: Story[];
  defaultInterval: number;
  width: string;
  height: string;
  keyboardNavigation: boolean;
  onAllStoriesEnd?: () => void;
  onStoryStart?: (index: number) => void;
  storyContainerStyles?: React.CSSProperties;
  storyStyles?: React.CSSProperties;
}>;

type StoryDisplayProps = {
  story: GeneratedImage;
  onAllStoriesEnd?: () => void;
  showShare?: boolean;
  showDownload?: boolean;
};

/**
 * Reusable story display component using react-insta-stories.
 * Used by both StoryPreviewModal (modal context) and StoryPage (fullscreen).
 */
export function StoryDisplay({
  story,
  onAllStoriesEnd,
  showShare = true,
  showDownload = true,
}: StoryDisplayProps) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const stories: Story[] = useMemo(
    () =>
      story.images.map((image) => ({
        url: image.url,
        header: {
          heading: 'Your Data Portrait',
          subheading: image.filename || '',
          profileImage: '',
        },
      })),
    [story.images]
  );

  const handleDownloadCurrent = () => {
    const currentImage = story.images[currentStoryIndex];
    if (currentImage) {
      window.open(currentImage.url, '_blank');
    }
  };

  const shareUrl = story.id
    ? `${window.location.origin}/story/${story.id}`
    : null;

  return (
    <div className="relative w-full h-full">
      <StoriesComponent
        stories={stories}
        defaultInterval={5000}
        width="100%"
        height="100%"
        keyboardNavigation
        onAllStoriesEnd={onAllStoriesEnd}
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

      {/* Action buttons */}
      <div className="absolute bottom-4 right-4 z-[999] flex gap-2 items-center">
        {showShare && shareUrl && <SocialShareButtons url={shareUrl} />}

        {showDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadCurrent}
            className="text-white hover:bg-white/90 hover:text-black rounded-full p-2.5 transition-all duration-200 hover:ring-2 hover:ring-white/50 hover:scale-105 active:scale-95"
            title="Download current story"
          >
            <Download className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
