import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface AaddyyArticleResponse {
  success: boolean;
  data: any; // Flexible to handle both formats
}

interface AaddyyTitleResponse {
  success: boolean;
  data: any; // Flexible to handle both formats
}

interface AaddyyImageResponse {
  success: boolean;
  data: any; // Flexible to handle both formats
}

/**
 * AI Service - Integrates with Aaddyy AI Services
 * 
 * Services:
 * - Title Generation (generate blog titles)
 * - Research Blog Writer (full blog posts with research)
 * - Image Generation (AI images)
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.AADDYY_API_KEY || '';
    this.apiUrl = process.env.AADDYY_API_URL || 'https://backend.aaddyy.com';

    console.log('\n🤖 === AADDYY AI SERVICE INITIALIZATION ===');
    console.log(`📋 API URL: ${this.apiUrl}`);
    console.log(`🔑 API Key: ${this.apiKey ? '****' + this.apiKey.slice(-4) : 'NOT SET'}`);
    
    if (!this.apiKey) {
      this.logger.error('❌ AADDYY_API_KEY is required but not set!');
      console.log('💡 Add AADDYY_API_KEY to backend/.env to use AI generation');
      console.log('⚠️  Website generation will fail without API key');
    } else {
      this.logger.log('✅ Aaddyy AI Service initialized with real API');
    }
    console.log('==========================================\n');
  }

  /**
   * Generate blog content using Aaddyy Research Blog Writer
   * @param topic - The blog topic/title
   */
  async generateBlog(topic: string): Promise<string> {
    console.log(`\n📝 === GENERATE BLOG ===`);
    console.log(`Topic: ${topic}`);
    
    if (!this.apiKey) {
      const error = 'AADDYY_API_KEY is not configured. Cannot generate content.';
      this.logger.error(`❌ ${error}`);
      throw new Error(error);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/research-blog-writer`);
    this.logger.log(`🤖 Generating blog with Aaddyy: ${topic.substring(0, 50)}...`);

    const response = await axios.post<AaddyyArticleResponse>(
      `${this.apiUrl}/api/ai/research-blog-writer`,
      {
        topic: topic,
        includeResearch: true,
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
      
      const content = response.data.data.content;
      
      if (!content) {
        console.log(`⚠️  Content field is undefined or empty`);
        throw new Error('Content field is missing from API response');
      }
      
      console.log(`   Article Type: ${response.data.data.articleType || 'N/A'}`);
      console.log(`   Processing Time: ${response.data.data.processingTime}ms`);
      console.log(`   URLs Processed: ${response.data.data.serviceInfo?.urlsProcessed || 0}`);
      console.log(`   Cost: $${response.data.data.cost}`);
      console.log(`   Remaining Credits: $${response.data.data.remainingCredits}`);
      console.log(`   Content Length: ${content.length} characters`);
      
      this.logger.log(`✅ Blog generated ($${response.data.data.cost}, ${response.data.data.serviceInfo?.urlsProcessed || 0} sources)`);
      return content;
    } else {
      this.logger.error('❌ Blog generation failed - API returned success: false');
      throw new Error('Blog generation failed - API returned unsuccessful response');
    }
  }

  /**
   * Generate multiple titles using Aaddyy Title Generator
   * @param prompt - The prompt/topic
   * @param quantity - Number of titles to generate
   */
  async generateTitles(prompt: string, quantity: number = 3): Promise<string[]> {
    console.log(`\n🔤 === GENERATE TITLES ===`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Quantity: ${quantity}`);
    
    if (!this.apiKey) {
      const error = 'AADDYY_API_KEY is not configured. Cannot generate titles.';
      this.logger.error(`❌ ${error}`);
      throw new Error(error);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/article-title`);
    this.logger.log(`📝 Generating ${quantity} titles with Aaddyy...`);

    const response = await axios.post<AaddyyTitleResponse>(
      `${this.apiUrl}/api/ai/article-title`,
      {
        topic: prompt,
        tone: 'professional',
        quantity: quantity,
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
      console.log(`   Cost: $${response.data.data.cost}`);
      console.log(`   Remaining Credits: $${response.data.data.remainingCredits}`);
      
      const titles = response.data.data.titles;
      
      if (!titles || !Array.isArray(titles) || titles.length === 0) {
        console.log(`❌ No titles found in response`);
        throw new Error('No titles returned from API');
      }
      
      console.log(`   Generated ${titles.length} titles`);
      titles.forEach((t: string, i: number) => {
        console.log(`   ${i + 1}. ${t.substring(0, 80)}...`);
      });
      
      this.logger.log(`✅ ${titles.length} titles generated ($${response.data.data.cost})`);
      return titles;
    } else {
      this.logger.error('❌ Title generation failed - API returned success: false');
      throw new Error('Title generation failed - API returned unsuccessful response');
    }
  }

  /**
   * Generate single title/heading using Aaddyy Title Generator
   * @param prompt - The prompt from database
   */
  async generateTitle(prompt: string): Promise<string> {
    const titles = await this.generateTitles(prompt, 1);
    return titles[0];
  }

  /**
   * Generate image using Aaddyy Image Generator
   * @param prompt - The image prompt from database
   */
  async generateImage(prompt: string): Promise<string> {
    console.log(`\n🎨 === GENERATE IMAGE ===`);
    console.log(`Prompt: ${prompt.substring(0, 100)}...`);
    
    if (!this.apiKey) {
      const error = 'AADDYY_API_KEY is not configured. Cannot generate image.';
      this.logger.error(`❌ ${error}`);
      throw new Error(error);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/image-generation`);
    this.logger.log(`🎨 Generating image with Aaddyy: ${prompt.substring(0, 50)}...`);

    const response = await axios.post<AaddyyImageResponse>(
      `${this.apiUrl}/api/ai/image-generation`,
      {
        prompt: prompt,
        size: '1024x1024',
        num_images: 1,
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
      console.log(`   Cost: $${response.data.data.cost}`);
      console.log(`   Remaining Credits: $${response.data.data.remainingCredits}`);
      
      let imageUrl: string | null = null;
      
      // Try standard format
      if (response.data.data.images && response.data.data.images.length > 0) {
        imageUrl = response.data.data.images[0].url;
        console.log(`   Using images[0].url format`);
      }
      
      if (!imageUrl) {
        console.log(`❌ Image URL not found in response`);
        console.log(`   Response:`, response.data.data);
        throw new Error('Image URL is missing from API response');
      }
      
      console.log(`   Image URL: ${imageUrl ? imageUrl.substring(0, 80) : 'N/A'}...`);
      this.logger.log(`✅ Image generated ($${response.data.data.cost})`);
      return imageUrl;
    } else {
      this.logger.error('❌ Image generation failed - API returned success: false');
      throw new Error('Image generation failed - API returned unsuccessful response');
    }
  }

  /**
   * Generate SEO metadata using AI
   * @param prompt - The SEO prompt from database
   */
  async generateSEO(prompt: string): Promise<{ title: string; description: string }> {
    console.log(`\n🔍 === GENERATE SEO ===`);
    console.log(`Prompt: ${prompt.substring(0, 100)}...`);
    
    if (!this.apiKey) {
      const error = 'AADDYY_API_KEY is not configured. Cannot generate SEO.';
      this.logger.error(`❌ ${error}`);
      throw new Error(error);
    }
    
    // Use title generator for SEO title
    const title = await this.generateTitle(prompt);
    
    // Use article generator for meta description
    console.log(`Generating meta description with Aaddyy...`);
    const response = await axios.post<AaddyyArticleResponse>(
      `${this.apiUrl}/api/ai/article`,
      {
        topic: `Write a compelling meta description for: ${prompt}`,
        length: 'short',
        tone: 'professional',
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      // Extract first 160 characters for meta description
      const description = response.data.data.article.substring(0, 160).trim();
      console.log(`✅ Meta description generated`);
      this.logger.log('🔍 SEO metadata generated');
      return { title, description };
    } else {
      throw new Error('SEO description generation failed');
    }
  }

  /**
   * Find synonyms and multiple meanings for a word
   * @param topic - The word/domain to find meanings for
   * @param similarWordsCount - Number of similar words/synonyms to find for each meaning
   * @returns Object with meaning as key and example sentence as value
   */
  async findSynonyms(topic: string, similarWordsCount: number = 5): Promise<Record<string, string>> {
    console.log(`\n🔍 === FIND SYNONYMS ===`);
    console.log(`Topic: ${topic}`);
    console.log(`Similar Words Count: ${similarWordsCount}`);
    
    if (!this.apiKey) {
      const error = 'AADDYY_API_KEY is not configured. Cannot find synonyms.';
      this.logger.error(`❌ ${error}`);
      throw new Error(error);
    }

    console.log(`Calling: POST ${this.apiUrl}/api/ai/synonym-finder`);
    this.logger.log(`🔍 Finding synonyms with Aaddyy: ${topic}`);

    const response = await axios.post(
      `${this.apiUrl}/api/ai/synonym-finder`,
      {
        topic: topic,
        similarWordsCount: similarWordsCount,
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
      console.log(`   Cost: $${response.data.data.cost}`);
      console.log(`   Remaining Credits: $${response.data.data.remainingCredits}`);
      
      // API returns "synonyms" not "meanings"
      const synonyms = response.data.data.synonyms || {};
      const meaningCount = Object.keys(synonyms).length;
      
      console.log(`   Found ${meaningCount} different meanings:`);
      Object.entries(synonyms).forEach(([meaning, exampleSentence]: [string, any]) => {
        console.log(`   - ${meaning}: ${exampleSentence}`);
      });
      
      this.logger.log(`✅ Found ${meaningCount} meanings ($${response.data.data.cost})`);
      return synonyms;
    } else {
      this.logger.error('❌ Synonym finder failed - API returned success: false');
      throw new Error('Synonym finder failed - API returned unsuccessful response');
    }
  }
}

