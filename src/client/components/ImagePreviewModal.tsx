import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

type ImagePreviewModalProps = {
  imageUrl: string | null;
  onClose: () => void;
};

function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() ?? null;
    return filename;
  } catch {
    return null;
  }
}

export function ImagePreviewModal({
  imageUrl,
  onClose,
}: ImagePreviewModalProps) {
  const handleShare = async () => {
    if (!imageUrl) return;

    const filename = extractFilenameFromUrl(imageUrl);
    if (!filename) return;

    const shareUrl = `${window.location.origin}/shared/${filename}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch {
      prompt('Copy this link:', shareUrl);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    window.open(imageUrl, '_blank');
  };

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full p-2"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Image */}
        <img
          src={imageUrl}
          alt="Generated portrait preview"
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Share button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="absolute bottom-4 right-20 bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full p-2"
          title="Copy share link"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </Button>

        {/* Download button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full p-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </Button>

        {/* Image info */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm">
          Generated Data Portrait • Click to download or share
        </div>
      </div>
    </div>
  );
}
