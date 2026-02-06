import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { StoryDisplay } from './StoryDisplay.js';
import type { GeneratedImage } from '../modules/PortraitGeneration.js';

type StoryPreviewModalProps = {
  story: GeneratedImage | null;
  onClose: () => void;
};

export function StoryPreviewModal({ story, onClose }: StoryPreviewModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!story || !story.images || story.images.length === 0) return null;

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

        {/* Story Display */}
        <div onClick={(e) => e.stopPropagation()} className="w-full h-full">
          <StoryDisplay
            story={story}
            onAllStoriesEnd={onClose}
            showShare={true}
            showDownload={true}
          />
        </div>
      </div>
    </div>
  );
}
