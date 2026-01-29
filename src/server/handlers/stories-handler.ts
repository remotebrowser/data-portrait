import type { Request, Response } from 'express';

export type StoryData = {
  id: string;
  stories: Array<{
    title: string;
    imageUrl: string;
  }>;
};

// Shared function to get story data - used by both API routes and SSR
export const getStoryData = (id: string): StoryData => {
  return {
    id,
    stories: [
      {
        title: 'Your Purchase Journey',
        imageUrl:
          'https://thumbs.dreamstime.com/b/autumn-colorful-forest-road-nature-landscape-vertical-image-narrow-winding-road-autumn-forest-nature-bright-colorful-landscape-102169317.jpg',
      },
      {
        title: 'Shopping Adventures',
        imageUrl:
          'https://media.istockphoto.com/id/1368628035/photo/brooklyn-bridge-at-sunset.jpg?s=612x612&w=0&k=20&c=hPbMbTYRAVNYWAUMkl6r62fPIjGVJTXzRURCyCfoG08=',
      },
      {
        title: 'Beautiful Purchases',
        imageUrl:
          'https://static.vecteezy.com/system/resources/thumbnails/055/040/907/small_2x/lush-green-tree-on-top-of-cliff-in-mountains-with-sun-rays-vertical-nature-background-generated-by-artificial-intelligence-photo.jpg',
      },
      {
        title: 'Nature-Inspired Shopping',
        imageUrl:
          'https://www.jessleephotos.com/images/xl/teton-overlook-autumn.jpg',
      },
    ],
  };
};

export const handleStoriesGeneration = (req: Request, res: Response) => {
  const storyId = crypto.randomUUID();
  setTimeout(() => {
    res.json({
      success: true,
      id: storyId,
    });
  }, 500);
};

export const handleStoriesPoll = (req: Request, res: Response) => {
  const { id } = req.params;
  setTimeout(() => {
    res.json({
      id,
      status: 'completed',
      progress: 100,
    });
  }, 300);
};

export const handleGetStories = (req: Request, res: Response) => {
  const { id } = req.params;
  setTimeout(() => {
    const storyData = getStoryData(id);
    res.json(storyData);
  }, 300);
};
