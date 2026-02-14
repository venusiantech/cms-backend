import axios from 'axios';
import { AppError } from '../middleware/error.middleware';
import { StorageService } from '../storage/storage.service';

export class AiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly storageService: StorageService;

  constructor() {
    this.apiKey = process.env.AADDYY_API_KEY || '';
    this.apiUrl = process.env.AADDYY_API_URL || 'https://backend.aaddyy.com';
    this.storageService = new StorageService();

    console.log('\n🤖 === AADDYY AI SERVICE INITIALIZATION ===');
    console.log(`📋 API URL: ${this.apiUrl}`);
    console.log(`🔑 API Key: ${this.apiKey ? '****' + this.apiKey.slice(-4) : 'NOT SET'}`);
    
    if (!this.apiKey) {
      console.warn('⚠️  AADDYY_API_KEY not set - AI features will fail');
    } else {
      console.log('✅ Aaddyy AI Service initialized');
    }
    console.log('==========================================\n');
  }

  /**
   * Generate article titles using AI
   */
  async generateTitle(topic: string, quantity: number = 1): Promise<string[]> {
    console.log(`\n🔤 === GENERATE TITLES ===`);
    console.log(`Topic: ${topic}`);
    console.log(`Quantity: ${quantity}`);

    // Validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      throw new AppError('Invalid topic: Topic must be a non-empty string', 400);
    }

    if (topic.length > 200) {
      throw new AppError(`Invalid topic: Topic too long (${topic.length} chars, max 200)`, 400);
    }

    if (!this.apiKey) {
      throw new AppError('AADDYY_API_KEY is not configured. Cannot generate titles.', 500);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/article-title`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/ai/article-title`,
        {
          topic,
          tone: 'professional',
          quantity,
          audience: 'general',
          keywords: topic,
          maxLength: 100,
          includeNumbers: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 1 minute timeout
        }
      );

      // Check if API returned success
      if (response.data.success) {
        console.log(`✅ Aaddyy API Success!`);
        console.log(`   Cost: $${response.data.data?.cost || 0}`);
        console.log(`   Remaining Credits: $${response.data.data?.remainingCredits || 0}`);

        const titles = response.data.data?.titles;

        if (!titles || !Array.isArray(titles) || titles.length === 0) {
          console.log(`❌ No titles found in response`);
          throw new AppError('No titles returned from API', 500);
        }

        console.log(`   Generated ${titles.length} titles:`);
        titles.forEach((t: string, i: number) => {
          console.log(`   ${i + 1}. ${t.substring(0, 80)}...`);
        });

        return titles;
      } else {
        const errorMsg = response.data.error || 'API returned success: false';
        console.error(`❌ Title generation failed: ${JSON.stringify(errorMsg)}`);
        throw new AppError(`Title generation failed: ${JSON.stringify(errorMsg)}`, 500);
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data?.error || error.response.data;
        console.error(`❌ AI API Error (${status}): ${JSON.stringify(errorData)}`);
        throw new AppError(`AI API Error (${status}): ${JSON.stringify(errorData)}`, status);
      } else if (error.request) {
        console.error(`❌ No response from AI API: ${error.message}`);
        throw new AppError(`No response from AI API (timeout or network error): ${error.message}`, 500);
      } else {
        console.error(`❌ Title generation error: ${error.message}`);
        throw new AppError(`Title generation error: ${error.message}`, 500);
      }
    }
  }

  /**
   * Generate blog content using research-blog-writer
   */
  async generateBlogContent(title: string): Promise<string> {
    console.log(`\n📝 === GENERATE BLOG ===`);
    console.log(`Topic: ${title}`);

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new AppError('Invalid topic: Topic must be a non-empty string', 400);
    }

    if (title.length > 500) {
      throw new AppError(`Invalid topic: Topic too long (${title.length} chars, max 500)`, 400);
    }

    // Detect if topic looks like an error message or placeholder
    const lowerTitle = title.toLowerCase();
    if (
      (lowerTitle.includes('apologies') && lowerTitle.includes('confusion')) ||
      (lowerTitle.includes('placeholder') && lowerTitle.includes('{{')) ||
      (lowerTitle.includes('provide') && lowerTitle.includes('details')) ||
      lowerTitle.includes('target audience:') ||
      lowerTitle.includes('- keywords:') ||
      title.length > 500
    ) {
      throw new AppError('Invalid topic: Topic appears to be an error message or placeholder request', 400);
    }

    if (!this.apiKey) {
      throw new AppError('AADDYY_API_KEY is not configured. Cannot generate content.', 500);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/research-blog-writer`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/ai/research-blog-writer`,
        {
          topic: title,
          includeResearch: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minutes timeout
        }
      );

      // Check if API returned success
      if (response.data.success) {
        console.log(`✅ Aaddyy API Success!`);

        const content = response.data.data?.content;

        if (!content) {
          console.log(`⚠️  Content field is undefined or empty`);
          throw new AppError('Content field is missing from API response', 500);
        }

        console.log(`   Article Type: ${response.data.data?.articleType || 'N/A'}`);
        console.log(`   Processing Time: ${response.data.data?.processingTime}ms`);
        console.log(`   URLs Processed: ${response.data.data?.serviceInfo?.urlsProcessed || 0}`);
        console.log(`   Cost: $${response.data.data?.cost || 0}`);
        console.log(`   Remaining Credits: $${response.data.data?.remainingCredits || 0}`);
        console.log(`   Content Length: ${content.length} characters`);

        return content;
      } else {
        const errorMsg = response.data.error || 'API returned success: false';
        console.error(`❌ Blog generation failed: ${JSON.stringify(errorMsg)}`);
        throw new AppError(`Blog generation failed: ${JSON.stringify(errorMsg)}`, 500);
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data?.error || error.response.data;
        console.error(`❌ AI API Error (${status}): ${JSON.stringify(errorData)}`);
        throw new AppError(`AI API Error (${status}): ${JSON.stringify(errorData)}`, status);
      } else if (error.request) {
        console.error(`❌ No response from AI API: ${error.message}`);
        throw new AppError(`No response from AI API (timeout or network error): ${error.message}`, 500);
      } else {
        console.error(`❌ Blog generation error: ${error.message}`);
        throw new AppError(`Blog generation error: ${error.message}`, 500);
      }
    }
  }

  /**
   * Generate image using AI
   */
  async generateImage(prompt: string, size: string = '1024x1024'): Promise<string> {
    console.log(`\n🎨 === GENERATE IMAGE ===`);
    console.log(`Prompt: ${prompt.substring(0, 100)}...`);

    if (!this.apiKey) {
      throw new AppError('AADDYY_API_KEY is not configured. Cannot generate image.', 500);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/image-generation`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/ai/image-generation`,
        {
          prompt,
          size,
          num_images: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 1 minute timeout
        }
      );

      // Check if API returned success
      if (response.data.success) {
        console.log(`✅ Aaddyy API Success!`);
        console.log(`   Cost: $${response.data.data?.cost || 0}`);
        console.log(`   Remaining Credits: $${response.data.data?.remainingCredits || 0}`);

        let imageUrl: string | null = null;

        // Debug: Log the entire response structure
        console.log(`   Response data keys:`, Object.keys(response.data.data || {}));
        if (response.data.data?.images) {
          console.log(`   Images array length:`, response.data.data.images.length);
        }

        // Try images array format (standard format)
        if (response.data.data?.images && response.data.data.images.length > 0) {
          imageUrl = response.data.data.images[0].url;
          console.log(`   ✅ Using images[0].url format`);
        }

        // Fallback to direct url field
        if (!imageUrl && response.data.data?.url) {
          imageUrl = response.data.data.url;
          console.log(`   ✅ Using direct url format`);
        }

        if (!imageUrl) {
          console.log(`❌ Image URL not found in response`);
          console.log(`   Full response.data.data:`, JSON.stringify(response.data.data, null, 2));
          throw new AppError('Image URL is missing from API response', 500);
        }

        console.log(`   Aaddyy Image URL: ${imageUrl.substring(0, 80)}...`);
        console.log(`   Uploading to S3 and generating signed URL...`);
        
        // Upload to S3 and get signed URL
        const s3SignedUrl = await this.storageService.uploadImageFromUrl(imageUrl);
        
        console.log(`   ✅ S3 URL: ${s3SignedUrl.substring(0, 100)}...`);
        
        return s3SignedUrl;
      } else {
        const errorMsg = response.data.error || 'API returned success: false';
        console.error(`❌ Image generation failed: ${JSON.stringify(errorMsg)}`);
        throw new AppError(`Image generation failed: ${JSON.stringify(errorMsg)}`, 500);
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data?.error || error.response.data;
        console.error(`❌ AI API Error (${status}): ${JSON.stringify(errorData)}`);
        throw new AppError(`AI API Error (${status}): ${JSON.stringify(errorData)}`, status);
      } else if (error.request) {
        console.error(`❌ No response from AI API: ${error.message}`);
        throw new AppError(`No response from AI API (timeout or network error): ${error.message}`, 500);
      } else {
        console.error(`❌ Image generation error: ${error.message}`);
        throw new AppError(`Image generation error: ${error.message}`, 500);
      }
    }
  }

  /**
   * Find synonyms for a word
   */
  async findSynonyms(word: string, count: number = 5): Promise<Record<string, string>> {
    console.log(`\n🔍 === FIND SYNONYMS ===`);
    console.log(`Topic: ${word}`);
    console.log(`Similar Words Count: ${count}`);

    if (!this.apiKey) {
      console.warn('⚠️  AADDYY_API_KEY not set - returning empty synonyms');
      return {};
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/synonym-finder`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/ai/synonym-finder`,
        {
          topic: word,
          similarWordsCount: count,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        console.log(`✅ Aaddyy API Success!`);
        console.log(`   Cost: $${response.data.data?.cost || 0}`);
        console.log(`   Remaining Credits: $${response.data.data?.remainingCredits || 0}`);

        // API returns "synonyms" object with meaning as key and example sentence as value
        const synonyms = response.data.data?.synonyms || {};
        const meaningCount = Object.keys(synonyms).length;

        console.log(`   Found ${meaningCount} different meanings:`);
        Object.entries(synonyms).forEach(([meaning, exampleSentence]: [string, any]) => {
          console.log(`   - ${meaning}: ${exampleSentence}`);
        });

        return synonyms;
      } else {
        console.error('❌ Synonym finder failed - API returned success: false');
        return {};
      }
    } catch (error: any) {
      console.error('❌ Synonym lookup failed:', error.response?.data || error.message);
      // Return empty object if API fails (non-critical feature)
      return {};
    }
  }

  /**
   * Generate content based on custom prompt from database
   */
  async generateWithPrompt(prompt: string, context?: Record<string, any>): Promise<string> {
    // Replace placeholders in prompt with context values
    let processedPrompt = prompt;
    if (context) {
      Object.keys(context).forEach((key) => {
        const placeholder = `{${key}}`;
        processedPrompt = processedPrompt.replace(
          new RegExp(placeholder, 'g'),
          context[key]
        );
      });
    }

    console.log(`\n🎯 === GENERATE WITH CUSTOM PROMPT ===`);
    console.log(`Prompt: ${processedPrompt.substring(0, 50)}...`);

    if (!this.apiKey) {
      throw new AppError('AADDYY_API_KEY is not configured', 500);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/research-blog-writer`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/api/ai/research-blog-writer`,
        {
          topic: processedPrompt,
          includeResearch: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      // Check if API returned success
      if (response.data.success) {
        const content = response.data.data?.content;

        if (!content) {
          throw new AppError('Content field is missing from API response', 500);
        }

        console.log(`✅ Generated content (${content.length} characters)`);
        return content;
      } else {
        const errorMsg = response.data.error || 'API returned success: false';
        console.error(`❌ Custom prompt generation failed: ${JSON.stringify(errorMsg)}`);
        throw new AppError(`Custom prompt generation failed: ${JSON.stringify(errorMsg)}`, 500);
      }
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data?.error || error.response.data;
        console.error(`❌ AI API Error (${status}): ${JSON.stringify(errorData)}`);
        throw new AppError(`AI API Error (${status}): ${JSON.stringify(errorData)}`, status);
      } else if (error.request) {
        console.error(`❌ No response from AI API: ${error.message}`);
        throw new AppError(`No response from AI API: ${error.message}`, 500);
      } else {
        console.error(`❌ Custom prompt generation error: ${error.message}`);
        throw new AppError(`Custom prompt generation error: ${error.message}`, 500);
      }
    }
  }
}
