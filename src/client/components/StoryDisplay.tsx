import { Button } from '@/components/ui/button.js';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import { useMemo, useRef, useState, type RefObject } from 'react';
import Stories from 'react-insta-stories';
import type { Story } from 'react-insta-stories/dist/interfaces.js';
import type {
  GeneratedImage,
  ImageData,
} from '../modules/PortraitGeneration.js';
import { SocialShareButtons } from './SocialShareButtons.js';

const STORY_LINK_OVERLAY_TEXT = 'dataportrait.app';

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
  isPaused?: boolean;
}>;

type StoryDisplayProps = {
  story: GeneratedImage;
  onAllStoriesEnd?: () => void;
  showShare?: boolean;
  showDownload?: boolean;
};

/**
 * Create a text story content component for react-insta-stories
 * Optionally attaches a ref to the root container so it can be captured.
 */
function createTextStoryContent(
  storyText: string,
  title: string | undefined,
  containerRef?: RefObject<HTMLDivElement | null>
) {
  return () => (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex flex-col items-center justify-center p-8 text-center"
    >
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
      <span className="absolute bottom-5 left-5 text-white text-sm font-medium drop-shadow-md">
        {STORY_LINK_OVERLAY_TEXT}
      </span>
    </div>
  );
}

/**
 * Transform ImageData array to react-insta-stories Story array
 * - If imageUrl exists (and is not empty), render as image story
 * - If storyText exists, render as text story
 * - If neither exists, skip the story
 */
function transformToStories(
  images: ImageData[],
  textStoryRef?: RefObject<HTMLDivElement | null>
): Story[] {
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
        content: createTextStoryContent(
          image.storyText!,
          image.title,
          textStoryRef
        ),
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
  const storiesRef = useRef<HTMLDivElement | null>(null);
  const [isShareOpened, setIsShareOpened] = useState(false);

  const stories: Story[] = useMemo(
    () => transformToStories(story.images, storiesRef),
    [story.images]
  );

  const onDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  };

  const onDownloadCurrent = async () => {
    const currentImage = story.images[currentStoryIndex];
    const isImage = currentImage?.url && currentImage.url.trim() !== '';
    const isText =
      currentImage?.storyText && currentImage.storyText.trim() !== '';

    let dataUrl: string | undefined;
    let filename: string;

    if (isImage) {
      dataUrl = currentImage.url;
      filename = `story-image-${currentStoryIndex + 1}.png`;
    } else if (isText && storiesRef.current) {
      dataUrl = await toPng(storiesRef.current as HTMLElement, {
        pixelRatio: 2,
      });
      filename = `story-text-${currentStoryIndex + 1}.png`;
    } else {
      return; // Nothing to download
    }

    onDownload(dataUrl, filename);
  };

  const onShareToggle = (state: boolean) => {
    setIsShareOpened(state);
  };

  const onStoryStart = (index: number) => {
    setCurrentStoryIndex(index);
    onShareToggle(false);
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
        onStoryStart={onStoryStart}
        isPaused={isShareOpened}
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
        {showShare && shareUrl && (
          <SocialShareButtons
            url={shareUrl}
            onToggleShareButtons={onShareToggle}
          />
        )}

        {showDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownloadCurrent}
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
