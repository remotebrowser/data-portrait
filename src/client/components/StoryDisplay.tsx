import { useState, useMemo } from 'react';
import Stories from 'react-insta-stories';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { SocialShareButtons } from './SocialShareButtons.js';
import type {
  GeneratedImage,
  ImageData,
} from '../modules/PortraitGeneration.js';
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
 * Create a text story content component for react-insta-stories
 */
function createTextStoryContent(storyText: string, title?: string) {
  return () => (
    <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-full overflow-y-auto">
        {title && (
          <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-lg">
            {title}
          </h2>
        )}
        <p className="text-lg text-white leading-relaxed drop-shadow-md whitespace-pre-wrap">
          {storyText}
        </p>
      </div>
    </div>
  );
}

/**
 * Transform ImageData array to react-insta-stories Story array
 * - If imageUrl exists (and is not empty), render as image story
 * - If storyText exists, render as text story
 * - If neither exists, skip the story
 */
function transformToStories(images: ImageData[]): Story[] {
  const stories: Story[] = [];

  for (const image of images) {
    const hasImage = image.url && image.url.trim() !== '';
    const hasText = image.storyText && image.storyText.trim() !== '';

    if (hasImage) {
      stories.push({
        url: image.url,
        header: {
          heading: image.title || 'Your Data Portrait',
          subheading: image.filename || '',
          profileImage: '',
        },
      });
    } else if (hasText) {
      stories.push({
        content: createTextStoryContent(image.storyText!, image.title),
        header: {
          heading: image.title || 'Your Story',
          subheading: '',
          profileImage: '',
        },
      });
    }
  }

  return stories;
}

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
    () => transformToStories(story.images),
    [story.images]
  );

  const handleDownloadCurrent = () => {
    const currentImage = story.images[currentStoryIndex];
    if (currentImage?.url) {
      window.open(currentImage.url, '_blank');
    }
  };

  // Check if current story is an image (has url)
  const isCurrentStoryImage = story.images[currentStoryIndex]?.url
    ? true
    : false;

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

        {showDownload && isCurrentStoryImage && (
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
