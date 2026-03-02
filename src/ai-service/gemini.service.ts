import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';
import { getGeminiModel } from './ai-provider.config';

export class GeminiService {
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';

    console.log('\n🤖 === GEMINI AI SERVICE INITIALIZATION ===');
    console.log(`🔑 API Key: ${apiKey ? '****' + apiKey.slice(-4) : 'NOT SET'}`);

    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not set - Gemini blog generation will fail');
    } else {
      console.log('✅ Gemini AI Service initialized');
    }
    console.log('==========================================\n');

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate a full markdown blog post using Gemini.
   * Returns content in the same format as Aaddyy's research-blog-writer:
   * # Title at top, ## sections, clean markdown, 800-1200 words.
   */
  async generateBlogContent(title: string): Promise<string> {
    console.log(`\n📝 === GEMINI GENERATE BLOG ===`);
    console.log(`Title: ${title}`);

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new AppError('Invalid title: Title must be a non-empty string', 400);
    }

    if (title.length > 500) {
      throw new AppError(`Invalid title: Title too long (${title.length} chars, max 500)`, 400);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('GEMINI_API_KEY is not configured. Cannot generate content.', 500);
    }

    const prompt = `Write a comprehensive, well-researched blog post about: "${title}"

Requirements:
- Start with a single # heading that is the article title
- Use ## for section headings (4-6 sections)
- Include a short introduction paragraph before the first section
- Each section should have 2-3 paragraphs of detailed, informative content
- End with a ## Conclusion section that summarizes key takeaways
- Length: 800-1200 words
- Tone: professional, informative, and engaging
- Format: clean Markdown only — no HTML, no frontmatter, no preamble
- Return ONLY the markdown content, nothing else`;

    const modelName = getGeminiModel();
    console.log(`   Model: ${modelName}`);

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = result.response;
      const content = response.text();

      if (!content || content.trim().length === 0) {
        throw new AppError('Gemini returned empty content', 500);
      }

      console.log(`✅ Gemini blog generated successfully`);
      console.log(`   Content Length: ${content.length} characters`);

      return content.trim();
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      const msg: string = error.message || '';
      if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
        console.error(`❌ Gemini quota exceeded for model "${modelName}". Switch to a higher-quota model in Admin → AI Providers.`);
        throw new AppError(
          `Gemini quota exceeded for model "${modelName}". Switch to gemini-2.5-flash or gemini-2.5-flash-lite in Admin → AI Providers.`,
          429
        );
      }
      console.error(`❌ Gemini blog generation error: ${msg}`);
      throw new AppError(`Gemini blog generation failed: ${msg}`, 500);
    }
  }
}
