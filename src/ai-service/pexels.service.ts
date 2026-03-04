import axios from 'axios';
import { AppError } from '../middleware/error.middleware';
import { StorageService } from '../storage/storage.service';

interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
  alt: string;
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
}

export class PexelsService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.pexels.com/v1';
  private readonly storageService: StorageService;

  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY || '';
    this.storageService = new StorageService();

    console.log('\n🖼️  === PEXELS SERVICE INITIALIZATION ===');
    console.log(`🔑 API Key: ${this.apiKey ? '****' + this.apiKey.slice(-4) : 'NOT SET'}`);
    if (!this.apiKey) {
      console.warn('⚠️  PEXELS_API_KEY not set - Pexels image fetching will fail');
    } else {
      console.log('✅ Pexels Service initialized');
    }
    console.log('==========================================\n');
  }

  /**
   * Derive a clean search query from an AI-generated image prompt.
   * Strips common prefixes like "Professional image for:" and trims to 60 chars.
   */
  private extractQuery(prompt: string): string {
    return prompt
      .replace(/^professional\s+image\s+for[:\s]*/i, '')
      .replace(/^image\s+for[:\s]*/i, '')
      .replace(/^photo\s+of[:\s]*/i, '')
      .trim()
      .substring(0, 60);
  }

  /**
   * Fetch a relevant photo from Pexels for the given prompt/topic,
   * upload it to storage, and return the stored URL.
   */
  async fetchImage(prompt: string): Promise<string> {
    console.log(`\n🖼️  === PEXELS FETCH IMAGE ===`);
    console.log(`Prompt: ${prompt.substring(0, 100)}`);

    if (!this.apiKey) {
      throw new AppError('PEXELS_API_KEY is not configured. Cannot fetch image.', 500);
    }

    const query = this.extractQuery(prompt);
    console.log(`   Search query: "${query}"`);

    try {
      const response = await axios.get<PexelsSearchResponse>(
        `${this.apiUrl}/search`,
        {
          params: {
            query,
            per_page: 3,
            orientation: 'landscape',
          },
          headers: {
            Authorization: this.apiKey,
          },
          timeout: 30000,
        }
      );

      const photos = response.data.photos;

      if (!photos || photos.length === 0) {
        console.warn(`⚠️  No Pexels photos found for query: "${query}"`);
        throw new AppError(`No Pexels photos found for query: "${query}"`, 404);
      }

      // Pick the first result and use large size for good quality without being too heavy
      const photo = photos[0];
      const imageUrl = photo.src.large;

      console.log(`   ✅ Found photo ID ${photo.id}: ${photo.alt || query}`);
      console.log(`   Pexels URL: ${imageUrl.substring(0, 80)}...`);
      console.log(`   Uploading to storage...`);

      const storedUrl = await this.storageService.uploadImageFromUrl(imageUrl);

      console.log(`   ✅ Stored URL: ${storedUrl.substring(0, 100)}...`);
      return storedUrl;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new AppError('Pexels API key is invalid or unauthorized.', 401);
        }
        if (status === 429) {
          throw new AppError('Pexels rate limit exceeded. Try again later.', 429);
        }
        throw new AppError(`Pexels API error (${status}): ${JSON.stringify(error.response.data)}`, status);
      } else if (error.request) {
        throw new AppError(`No response from Pexels API: ${error.message}`, 500);
      }
      throw new AppError(`Pexels image fetch failed: ${error.message}`, 500);
    }
  }
}
