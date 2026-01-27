const GCS_BUCKET_NAME = 'data-portrait-imagegen';

export interface SSRMetadata {
  [key: string]: string;
}

export function getMetadata(filename: string): SSRMetadata {
  const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
  return {
    'og:title': 'Data Portrait by GetGather',
    'og:description':
      'Transform your shopping history into stunning personalized portraits',
    'og:image': imageUrl,
    'og:type': 'website',
    'twitter:card': 'summary_large_image',
    'twitter:image': imageUrl,
  };
}
