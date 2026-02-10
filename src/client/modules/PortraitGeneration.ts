import type { PurchaseHistory } from './DataTransformSchema.js';

export type ImageFormat = 'single' | 'stories';

export type ImageData = {
  url: string;
  model?: string;
  provider?: string;
  timestamp: string;
  filename?: string;
  style?: string[];
  storyText?: string;
  title?: string;
};

export type GeneratedImage = {
  format: ImageFormat;
  images: ImageData[];
  id?: string;
};

type GenerationParams = {
  imageStyle: string[];
  gender: string;
  traits: string[];
  purchaseData: PurchaseHistory[];
  uploadedImage?: File | null;
};

type SingleImageResponse = {
  success: boolean;
  image: {
    url: string;
    filename?: string;
  };
  model?: string;
  provider?: string;
  timestamp?: string;
  message?: string;
};

type StoriesInitResponse = {
  success: boolean;
  id: string;
};

type StoriesPollResponse = {
  id: string;
  status: string;
  progress?: number;
};

type StoryItem = {
  title?: string;
  imageUrl: string;
  storyText?: string;
};

type StoriesResponse = {
  id: string;
  stories: StoryItem[];
};

function createImageData(
  url: string,
  imageStyle: string[],
  model: string = 'gemini',
  provider: string = 'unknown',
  timestamp: string = new Date().toISOString(),
  filename: string = 'unknown',
  storyText?: string,
  title?: string
): ImageData {
  return {
    url,
    model,
    provider,
    timestamp,
    filename,
    style: imageStyle,
    storyText,
    title,
  };
}

function createGeneratedImage(
  format: ImageFormat,
  images: ImageData[],
  id?: string
): GeneratedImage {
  return {
    format,
    images,
    id,
  };
}

async function pollUntilCompleted(storyId: string): Promise<void> {
  while (true) {
    const pollResponse = await fetch(`/getgather/stories/poll/${storyId}`);
    if (!pollResponse.ok) {
      throw new Error(`HTTP error! status: ${pollResponse.status}`);
    }
    const pollData: StoriesPollResponse = await pollResponse.json();
    if (pollData.status === 'completed') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function generateSingleImage(
  params: GenerationParams
): Promise<GeneratedImage> {
  const { imageStyle, gender, traits, purchaseData, uploadedImage } = params;

  const body = uploadedImage
    ? (() => {
        const formData = new FormData();
        formData.append('image', uploadedImage);
        formData.append('imageStyle', imageStyle.join(','));
        formData.append('gender', gender);
        formData.append('traits', traits.join(','));
        formData.append('purchaseData', JSON.stringify(purchaseData));
        return formData;
      })()
    : JSON.stringify({
        imageStyle,
        gender,
        traits,
        purchaseData,
      });

  const response = await fetch('/getgather/generate-from-purchase', {
    method: 'POST',
    headers: uploadedImage ? {} : { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: SingleImageResponse = await response.json();

  if (!data.success || !data.image) {
    throw new Error(data.message || 'Failed to generate portrait');
  }

  const imageData = createImageData(
    `${data.image.url}?t=${Date.now()}`,
    imageStyle,
    data.model,
    data.provider,
    data.timestamp,
    data.image.filename
  );

  return createGeneratedImage('single', [imageData]);
}

async function generateStories(
  params: GenerationParams
): Promise<GeneratedImage> {
  const { imageStyle, gender, traits, purchaseData } = params;

  const initResponse = await fetch('/getgather/generate/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageStyle,
      gender,
      traits,
      purchaseData,
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`HTTP error! status: ${initResponse.status}`);
  }

  const initData: StoriesInitResponse = await initResponse.json();
  const storyId = initData.id;

  if (!storyId) {
    throw new Error('Failed to start stories generation');
  }

  await pollUntilCompleted(storyId);

  const storiesResponse = await fetch(`/getgather/stories/${storyId}`);
  if (!storiesResponse.ok) {
    throw new Error(`HTTP error! status: ${storiesResponse.status}`);
  }

  const storiesData: StoriesResponse = await storiesResponse.json();

  if (!storiesData.stories || !Array.isArray(storiesData.stories)) {
    throw new Error('Invalid stories response format');
  }

  const images = storiesData.stories.map((story) =>
    createImageData(
      story.imageUrl,
      imageStyle,
      'gemini',
      'unknown',
      new Date().toISOString(),
      story.title || 'unknown',
      story.storyText
    )
  );

  return createGeneratedImage('stories', images, storiesData.id);
}

export async function generatePortrait(
  format: ImageFormat,
  params: GenerationParams
): Promise<GeneratedImage> {
  if (format === 'stories') {
    return generateStories(params);
  } else {
    return generateSingleImage(params);
  }
}
