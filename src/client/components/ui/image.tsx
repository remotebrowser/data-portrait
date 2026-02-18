import { useState } from 'react';

function Image({
  imageUrl,
  showBadge,
  onClick,
}: {
  imageUrl: string;
  showBadge: boolean;
  onClick: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div className="aspect-square relative bg-gray-100" onClick={onClick}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-xs text-center px-2">Failed to load image</div>
          <button
            className="text-xs text-blue-500 mt-1 underline"
            onClick={(e) => {
              e.stopPropagation();
              setError(false);
              setLoading(true);
              // Force reload by adding timestamp
              const img =
                e.currentTarget.parentElement?.parentElement?.querySelector(
                  'img'
                );
              if (img) {
                const url = new URL(img.src);
                url.searchParams.set('retry', Date.now().toString());
                img.src = url.toString();
              }
            }}
          >
            Retry
          </button>
        </div>
      )}

      <img
        src={imageUrl}
        alt="Generated portrait"
        className={`w-full h-full object-cover hover:scale-105 ${error ? 'opacity-0' : 'opacity-100'}`}
        key={imageUrl}
        onLoad={handleLoad}
        onError={handleError}
        style={{ display: error ? 'none' : 'block' }}
      />

      {showBadge && !error && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
          New
        </div>
      )}
    </div>
  );
}

export { Image };
