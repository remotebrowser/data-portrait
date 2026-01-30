import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StoryDisplay } from '../components/StoryDisplay.js';
import type { GeneratedImage } from '../modules/PortraitGeneration.js';

type StoriesApiResponse = {
  id: string;
  stories: Array<{
    title: string;
    imageUrl: string;
  }>;
};

export function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) {
      setError('Story ID is missing');
      setLoading(false);
      return;
    }

    const fetchStory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/getgather/stories/${storyId}`);

        if (!response.ok) {
          throw new Error('Story not found');
        }

        const data: StoriesApiResponse = await response.json();

        // Transform API response to GeneratedImage format
        const generatedImage: GeneratedImage = {
          id: data.id,
          format: 'stories',
          images: data.stories.map((story, index) => ({
            url: story.imageUrl,
            filename: `story-${index + 1}.png`,
            timestamp: new Date().toISOString(),
          })),
        };

        setStory(generatedImage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load story');
      } finally {
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading story...</div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-4">
        <div className="text-white text-xl mb-4">
          {error || 'Story not found'}
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Go to homepage
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="relative max-w-md w-full h-[100dvh] flex flex-col items-center justify-center">
        <StoryDisplay story={story} />
      </div>
    </div>
  );
}
