import * as fs from 'node:fs';
import * as path from 'node:path';

type UploadResult = {
  url: string;
  filename: string;
  fileSize: number;
};

export const localStorageService = {
  async uploadImage(
    base64Data: string,
    filename: string
  ): Promise<UploadResult> {
    const publicPath = path.join(process.cwd(), 'public', filename);
    const publicDir = path.join(process.cwd(), 'public');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(publicPath, buffer);

    return {
      url: `/${filename}`,
      filename,
      fileSize: buffer.length,
    };
  },
};
