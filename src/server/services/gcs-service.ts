import { Storage } from '@google-cloud/storage';
import { ServerLogger as Logger } from '../utils/logger/index.js';
import { settings } from '../config.js';

type UploadResult = {
  url: string;
  filename: string;
  fileSize: number;
};

type StoryMetadata = {
  id: string;
  createdAt: string;
  stories: Array<{
    type: 'image' | 'text';
    title: string;
    content: string;
    imageUrl?: string;
    filename?: string;
  }>;
};

const METADATA_FILENAME_PREFIX = 'story-';
const METADATA_FILENAME_SUFFIX = '.json';

function getMetadataFilename(jobId: string): string {
  return `${METADATA_FILENAME_PREFIX}${jobId}${METADATA_FILENAME_SUFFIX}`;
}

export const gcsService = {
  async uploadImage(
    base64Data: string,
    filename: string
  ): Promise<UploadResult> {
    const storage = new Storage({
      projectId: settings.GCS_PROJECT_ID,
    });

    const bucket = storage.bucket(settings.GCS_BUCKET_NAME);
    const buffer = Buffer.from(base64Data, 'base64');
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      },
    });

    await file.makePublic();

    const publicUrl = `/shared/image/${filename}`;

    return {
      url: publicUrl,
      filename,
      fileSize: buffer.length,
    };
  },

  async uploadMetadata(metadata: StoryMetadata): Promise<void> {
    const storage = new Storage({
      projectId: settings.GCS_PROJECT_ID,
    });

    const bucket = storage.bucket(settings.GCS_BUCKET_NAME);
    const filename = getMetadataFilename(metadata.id);
    const file = bucket.file(filename);

    const jsonContent = JSON.stringify(metadata, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');

    await file.save(buffer, {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000',
      },
    });

    await file.makePublic();
  },

  async downloadMetadata(jobId: string): Promise<StoryMetadata | null> {
    try {
      const storage = new Storage({
        projectId: settings.GCS_PROJECT_ID,
      });

      const bucket = storage.bucket(settings.GCS_BUCKET_NAME);
      const filename = getMetadataFilename(jobId);
      const file = bucket.file(filename);

      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      const jsonString = content.toString('utf-8');
      const metadata: unknown = JSON.parse(jsonString);

      if (
        typeof metadata === 'object' &&
        metadata !== null &&
        'id' in metadata &&
        'createdAt' in metadata &&
        'stories' in metadata &&
        Array.isArray((metadata as StoryMetadata).stories)
      ) {
        return metadata as StoryMetadata;
      }

      return null;
    } catch (error) {
      Logger.error('Failed to download metadata', error as Error, {
        component: 'gcs-service',
        operation: 'download-metadata',
        jobId,
      });
      return null;
    }
  },
};

export type { StoryMetadata };
