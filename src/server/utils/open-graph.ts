interface OpenGraphData {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  siteName?: string;
}

export function generateOpenGraphTags(data: OpenGraphData): string[] {
  const tags: string[] = [];
  tags.push(`<meta property="og:title" content="${escapeHtml(data.title)}" />`);
  tags.push(
    `<meta property="og:description" content="${escapeHtml(data.description)}" />`
  );
  tags.push(
    `<meta property="og:image" content="${escapeHtml(data.imageUrl)}" />`
  );
  tags.push(`<meta property="og:url" content="${escapeHtml(data.url)}" />`);
  tags.push(`<meta property="og:type" content="website" />`);

  if (data.siteName) {
    tags.push(
      `<meta property="og:site_name" content="${escapeHtml(data.siteName)}" />`
    );
  }
  return tags;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
