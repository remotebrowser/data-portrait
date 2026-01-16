import { useParams } from 'react-router-dom';

const GCS_BUCKET_NAME = 'data-portrait-imagegen';

export function SharedPortrait() {
  const { filename } = useParams<{ filename: string }>();

  if (!filename) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Invalid share link</div>
      </div>
    );
  }

  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center">
        <a
          href={imageUrl}
          download={`data-portrait-${Date.now()}.png`}
          className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Download
        </a>
        <img
          src={imageUrl}
          alt="Shared data portrait"
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="text-white mt-4 text-center">
          Shared Data Portrait{' '}
          <a href="/" className="underline hover:text-gray-300">
            Create your own
          </a>
        </p>
      </div>
    </div>
  );
}
