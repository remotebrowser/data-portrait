import { GoogleGenAI } from '@google/genai';
import { settings } from '../config.js';

const genAI = new GoogleGenAI({ apiKey: settings.GEMINI_API_KEY });

const STYLE_PROMPTS = {
  realistic:
    'A photorealistic professional portrait, natural lighting, detailed features',
  professional:
    'A professional business headshot, corporate attire, clean background',
  cartoon: 'A cheerful cartoon character, vibrant colors, friendly style',
  anime:
    'An anime-style character portrait, large expressive eyes, detailed hair',
  'action-figure':
    'A collectible action figure style, toy-like appearance, bold colors',
  superhero:
    'A superhero character, comic book style, heroic pose, dynamic lighting',
  disney: 'A Disney/Pixar animation style, wholesome appearance, bright colors',
  cyberpunk:
    'A cyberpunk character, neon lighting, futuristic clothing, sci-fi aesthetic',
  vintage:
    'A vintage portrait, retro styling, classic clothing, nostalgic atmosphere',
  minimalist:
    'A clean minimalist portrait, simple background, elegant composition',
  artistic:
    'An artistic painted portrait, brushstroke textures, creative lighting',
  'pixel-art':
    'An 8-bit pixel art character, retro gaming style, vibrant colors',
};

const TRAIT_MAPPINGS = {
  none: '',
  'middle-eastern': 'Middle Eastern ethnicity',
  'east-asian': 'East Asian ethnicity',
  'south-asian': 'South Asian ethnicity',
  african: 'African ethnicity',
  'hispanic-latino': 'Hispanic or Latino ethnicity',
  'curly-black-hair': 'curly black hair',
  'straight-blonde-hair': 'straight blonde hair',
  'wavy-brown-hair': 'wavy brown hair',
  'red-hair': 'red hair',
  glasses: 'wearing glasses',
  beard: 'with beard',
  'young-adult': 'young adult appearance',
  'middle-aged': 'middle-aged appearance',
  'background-blur': '',
};

const PROMPT_TEMPLATE =
  'Portrait of a person: {{style}}, {{gender}}{{traits}}. The person should be the main focal point{{bookshelf}}{{products}}. The overall scene should feel authentic and lived-in, perfectly balanced composition with professional lighting and attention to detail, ensuring the human figure is prominently featured';

interface PromptParams {
  imageStyle: string | string[];
  gender: string;
  traits: string[];
  purchaseData?: any[];
}

class PromptService {
  async buildPrompt({
    imageStyle,
    gender,
    traits,
    purchaseData,
  }: PromptParams): Promise<string> {
    // Handle product categorization internally
    let books: string[] = [];
    let products: string[] = [];

    if (purchaseData && purchaseData.length > 0) {
      for (let order of purchaseData) {
        if (order.brand === 'Goodreads') {
          books.push(...order.product_names);
        } else {
          products.push(...order.product_names);
        }
      }
    }

    const simplifiedProducts = await this.simplifyProductDescriptions(products);

    // Build and return final prompt
    return this.assemblePrompt({
      imageStyle,
      gender,
      traits,
      books,
      products: simplifiedProducts,
    });
  }

  private async simplifyProductDescriptions(
    products: string[]
  ): Promise<string[]> {
    if (!products || products.length === 0) {
      return [];
    }

    const simplificationPrompt = `
Simplify these product descriptions into concise, essential names (2-3 words maximum each):

${products.map((product, index) => `${index + 1}. ${product}`).join('\n')}

Guidelines:
- Keep only the core product type/name
- Remove brand names, technical specs, and marketing language
- Remove sizing details, colors, and model numbers
- Focus on what the item actually is

Example:
"3 Pack of USB C Headphones [MFi Certified],Type C Earphones HiFi Stereo Wired Earbuds,Magnetic Noise Canceling in-Ear Headset with Microphone for iPhone 15/16/15 16 Plus/15 16Pro/15 16Pro Max"
becomes:
"USB C Headphones"

Format your response as a numbered list:
1. [simplified name]
2. [simplified name]
etc.`;

    try {
      const response = await genAI.models.generateContent({
        model: 'gemini-1.5-flash-8b',
        contents: simplificationPrompt,
      });

      const result =
        response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!result) {
        console.warn('⚠️ Product simplification failed, using original names');
        return products;
      }

      console.log('🔍 AI simplification result:', result);

      // Parse the numbered list response
      const simplifiedItems = result
        .split('\n')
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);

      // Ensure we have the same number of items
      if (simplifiedItems.length !== products.length) {
        console.warn(
          `⚠️ Mismatch in product count: ${products.length} original vs ${simplifiedItems.length} simplified`
        );
        return products;
      }

      console.log(`✅ Simplified ${products.length} products`);
      return simplifiedItems;
    } catch (error) {
      console.error('❌ Product simplification failed:', error);
      return products;
    }
  }

  private assemblePrompt({
    imageStyle,
    gender,
    traits,
    books,
    products,
  }: {
    imageStyle: string | string[];
    gender: string;
    traits: string[];
    books: string[];
    products: string[];
  }): string {
    const styleIds = Array.isArray(imageStyle) ? imageStyle : [imageStyle];
    const stylePromptParts = styleIds
      .map((id) => STYLE_PROMPTS[id as keyof typeof STYLE_PROMPTS])
      .filter(Boolean);

    const stylePrompt =
      stylePromptParts.length > 0
        ? stylePromptParts.join(', ')
        : STYLE_PROMPTS['realistic'];
    const genderPrompt =
      gender === 'Male'
        ? 'masculine features, male presentation'
        : gender === 'Female'
          ? 'feminine features, female presentation'
          : 'androgynous features, non-binary presentation';

    const traitsPrompt =
      traits?.length > 0
        ? `, ${traits
            .map(
              (trait: string) =>
                TRAIT_MAPPINGS[trait as keyof typeof TRAIT_MAPPINGS]
            )
            .filter(Boolean)
            .join(', ')}`
        : '';

    const bookshelfPrompt =
      books.length > 0
        ? `, with a well-organized bookshelf displaying these book titles: ${books.slice(0, 4).join(', ')}${books.length > 4 ? ' and other books' : ''}`
        : '';

    const productsPrompt =
      products.length > 0
        ? `${books.length > 0 ? ', and' : ', in'} an aesthetic room environment that reflects their interests and preferences through elements like ${products.slice(0, 4).join(', ')}${products.length > 4 ? ' and other personal items' : ''}`
        : '';

    return PROMPT_TEMPLATE.replace('{{style}}', stylePrompt)
      .replace('{{gender}}', genderPrompt)
      .replace('{{traits}}', traitsPrompt)
      .replace('{{bookshelf}}', bookshelfPrompt)
      .replace('{{products}}', productsPrompt);
  }
}

export const promptService = new PromptService();
