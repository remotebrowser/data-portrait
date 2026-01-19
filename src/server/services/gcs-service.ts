import { Storage } from '@google-cloud/storage';
import { settings } from '../config.js';

type UploadResult = {
  url: string;
  filename: string;
  fileSize: number;
};

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

    const publicUrl = `https://storage.googleapis.com/${settings.GCS_BUCKET_NAME}/${filename}`;

    return {
      url: publicUrl,
      filename,
      fileSize: buffer.length,
    };
  },
};
