type ImageStyle = {
  id: string;
  name: string;
  description: string;
  preview: string;
  gradient: string;
  category: string;
};

export const IMAGE_STYLES: Array<ImageStyle> = [
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Photorealistic portraits',
    preview: '📸',
    gradient: 'from-gray-100 to-gray-200',
    category: 'photography',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Business headshot style',
    preview: '💼',
    gradient: 'from-slate-100 to-gray-300',
    category: 'photography',
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    description: 'Fun animated style',
    preview: '🎨',
    gradient: 'from-orange-100 to-red-200',
    category: 'animation',
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese animation style',
    preview: '🌸',
    gradient: 'from-pink-100 to-purple-200',
    category: 'animation',
  },
  {
    id: 'action-figure',
    name: 'Action Figure',
    description: 'Collectible toy style',
    preview: '🦸',
    gradient: 'from-red-100 to-orange-200',
    category: 'gaming',
  },
  {
    id: 'superhero',
    name: 'Superhero',
    description: 'Comic book hero style',
    preview: '⚡',
    gradient: 'from-blue-100 to-indigo-200',
    category: 'gaming',
  },
  {
    id: 'disney',
    name: 'Disney',
    description: 'Disney animation style',
    preview: '🏰',
    gradient: 'from-yellow-100 to-pink-200',
    category: 'animation',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Futuristic neon aesthetic',
    preview: '🌆',
    gradient: 'from-cyan-100 to-purple-200',
    category: 'futuristic',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Retro aesthetic',
    preview: '📻',
    gradient: 'from-amber-100 to-yellow-200',
    category: 'artistic',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean, simple design',
    preview: '⚪',
    gradient: 'from-blue-100 to-cyan-200',
    category: 'artistic',
  },
  {
    id: 'artistic',
    name: 'Artistic',
    description: 'Painterly art style',
    preview: '🖼️',
    gradient: 'from-purple-100 to-pink-200',
    category: 'artistic',
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    description: '8-bit retro gaming style',
    preview: '🎮',
    gradient: 'from-green-100 to-blue-200',
    category: 'gaming',
  },
];

export const STYLE_CATEGORIES = {
  photography: { name: 'Photography', icon: '📸' },
  animation: { name: 'Animation', icon: '🎬' },
  gaming: { name: 'Gaming', icon: '🎮' },
  artistic: { name: 'Artistic', icon: '🎨' },
  futuristic: { name: 'Futuristic', icon: '🚀' },
};

export function getRandomStyle(): string {
  return IMAGE_STYLES[Math.floor(Math.random() * IMAGE_STYLES.length)].id;
}
