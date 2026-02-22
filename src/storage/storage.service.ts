import * as AWS from 'aws-sdk';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';

/**
 * Simple S3 Storage Service (AWS SDK v2)
 * Downloads images from external URLs and uploads to our S3 bucket
 */
export class StorageService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    // Support both AWS_ and S3_ prefixes for flexibility
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 
                       process.env.S3_BUCKET_NAME || 
                       'neat-bottle-0mqojiahjqfx3';
    
    // Initialize S3 client (matching colleague's working config)
    const s3Config: any = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION || process.env.S3_REGION || 'auto',
      signatureVersion: 'v4',
    };

    // Add endpoint for S3-compatible storage (Tigris)
    const endpointUrl = process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT_URL;
    if (endpointUrl) {
      s3Config.endpoint = new AWS.Endpoint(endpointUrl);
      s3Config.s3ForcePathStyle = true; // Required for Tigris
    }

    this.s3 = new AWS.S3(s3Config);

    console.log('✅ S3 Storage Service initialized');
    console.log(`   Endpoint: ${endpointUrl}`);
    console.log(`   Bucket: ${this.bucketName}`);
  }

  /**
   * Download image from URL and upload to S3
   * @param imageUrl - External image URL (e.g., from Aaddyy)
   * @param fileName - Custom filename (optional, will generate if not provided)
   * @returns Signed S3 URL (valid for 7 days)
   */
  async uploadImageFromUrl(imageUrl: string, fileName?: string): Promise<string> {
    try {
      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const imageBuffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/png';

      // Generate filename if not provided
      if (!fileName) {
        const timestamp = Date.now();
        const uuid = uuidv4();
        const extension = contentType.split('/')[1]?.split(';')[0] || 'png';
        fileName = `images/${timestamp}-${uuid}.${extension}`;
      }

      // Upload to S3 with PRIVATE ACL
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: imageBuffer,
        ContentType: contentType,
        ACL: 'private',
      };

      const result = await this.s3.upload(params).promise();
      
      // Generate signed URL (7 days expiry)
      const signedUrl = await this.getSignedUrl(result.Key, 604800);
      
      return signedUrl;
    } catch (error: any) {
      console.error('❌ S3 upload failed:', error.message);
      throw new AppError('Failed to upload image to S3 storage', 500);
    }
  }

  /**
   * Upload buffer directly to S3
   * @param buffer - Image buffer
   * @param contentType - MIME type (e.g., 'image/png')
   * @param fileName - Optional custom filename
   * @returns Signed URL of uploaded image
   */
  async uploadBuffer(buffer: Buffer, contentType: string, fileName?: string): Promise<string> {
    try {
      if (!fileName) {
        const timestamp = Date.now();
        const uuid = uuidv4();
        const extension = contentType.split('/')[1]?.split(';')[0] || 'png';
        fileName = `images/${timestamp}-${uuid}.${extension}`;
      }

      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        ACL: 'private',
      };

      const result = await this.s3.upload(params).promise();
      
      // Generate signed URL (7 days)
      const signedUrl = await this.getSignedUrl(result.Key, 604800);

      return signedUrl;
    } catch (error: any) {
      console.error('❌ Failed to upload buffer to S3:', error.message);
      throw new AppError('Failed to upload image to storage', 500);
    }
  }

  /**
   * Generate a signed URL for accessing S3 files
   * @param fileKey - S3 object key (e.g., "images/123456-uuid.png")
   * @param expiresIn - Expiration time in seconds (default: 7 days)
   * @returns Signed URL
   */
  async getSignedUrl(fileKey: string, expiresIn: number = 604800): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
        Expires: expiresIn,
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error: any) {
      console.error('❌ Failed to generate signed URL:', error.message);
      throw new AppError('Failed to generate signed URL', 500);
    }
  }

  /**
   * Upload a logo image (private ACL) and return a long-lived signed URL (1 year).
   * @param buffer - Image buffer
   * @param contentType - MIME type (e.g., 'image/png')
   * @param fileName - Optional custom filename
   * @returns { signedUrl, key } - Signed URL (1 year expiry) and S3 key (for future deletion/refresh)
   */
  async uploadLogoPublic(buffer: Buffer, contentType: string, fileName?: string): Promise<{ publicUrl: string; key: string }> {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = contentType.split('/')[1]?.split(';')[0] || 'png';
    const key = fileName || `logos/${timestamp}-${uuid}.${extension}`;

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'private',
    };

    await this.s3.upload(params).promise();

    // Generate signed URL — max 7 days (604800s) enforced by AWS Signature V4 / Tigris
    const signedUrl = await this.getSignedUrl(key, 604800);

    return { publicUrl: signedUrl, key };
  }

  /**
   * Check if S3 is configured
   * @returns true if credentials and bucket are configured
   */
  isS3Configured(): boolean {
    const hasCredentials = !!(
      (process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
      (process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)
    );
    const hasBucket = !!(
      process.env.AWS_S3_BUCKET_NAME ||
      process.env.S3_BUCKET_NAME
    );
    return hasCredentials && hasBucket;
  }

  /**
   * Delete file from S3
   * @param fileKey - S3 object key
   */
  async deleteFromS3(fileKey: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
      };

      await this.s3.deleteObject(params).promise();
    } catch (error: any) {
      console.error('❌ Failed to delete from S3:', error.message);
      throw new AppError(`S3 deletion failed: ${error.message}`, 500);
    }
  }

  /**
   * Check if a URL is an S3 URL from our bucket
   * @param url - URL to check
   * @returns true if it's our S3 URL
   */
  isS3Url(url: string): boolean {
    return url.includes(this.bucketName) || url.includes('t3.storageapi.dev');
  }

  /**
   * Extract S3 key from signed URL
   * @param url - S3 URL (signed or unsigned)
   * @returns S3 key (e.g., "images/123456-uuid.png")
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Remove leading slash and bucket name if present
      // Format: /bucket-name/images/file.png or /images/file.png
      const parts = pathname.split('/').filter(p => p);
      
      // If first part is bucket name, skip it
      if (parts[0] === this.bucketName) {
        return parts.slice(1).join('/');
      }
      
      return parts.join('/');
    } catch (error) {
      return null;
    }
  }
}
