import * as AWS from 'aws-sdk';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import { getStorageProvider } from './storage-provider.config';

/**
 * Storage Service: Railway (S3) or Cloudinary, selectable by admin.
 */
export class StorageService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    this.bucketName =
      process.env.AWS_S3_BUCKET_NAME ||
      process.env.S3_BUCKET_NAME ||
      'neat-bottle-0mqojiahjqfx3';

    const s3Config: any = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION || process.env.AWS_REGION || 'auto',
      signatureVersion: 'v4',
    };

    const endpointUrl = process.env.AWS_ENDPOINT_URL || process.env.S3_ENDPOINT_URL;
    if (endpointUrl) {
      s3Config.endpoint = new AWS.Endpoint(endpointUrl);
      s3Config.s3ForcePathStyle = true;
    }

    this.s3 = new AWS.S3(s3Config);

    if (process.env.CLOUDINARY_URL) {
      cloudinary.config();
    } else if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }

    console.log('✅ Storage Service initialized');
    console.log(`   Provider: ${getStorageProvider()}`);
  }

  async uploadImageFromUrl(imageUrl: string, fileName?: string): Promise<string> {
    if (getStorageProvider() === 'cloudinary') {
      return this.uploadImageFromUrlCloudinary(imageUrl, fileName);
    }
    return this.uploadImageFromUrlS3(imageUrl, fileName);
  }

  private async uploadImageFromUrlS3(imageUrl: string, fileName?: string): Promise<string> {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/png';
    if (!fileName) {
      const timestamp = Date.now();
      const uuid = uuidv4();
      const extension = contentType.split('/')[1]?.split(';')[0] || 'png';
      fileName = `images/${timestamp}-${uuid}.${extension}`;
    }
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: imageBuffer,
      ContentType: contentType,
      ACL: 'private',
    };
    const result = await this.s3.upload(params).promise();
    return this.getSignedUrl(result.Key, 604800);
  }

  private async uploadImageFromUrlCloudinary(imageUrl: string, fileName?: string): Promise<string> {
    try {
      const publicId = fileName
        ? fileName.replace(/\.[^.]+$/, '').replace(/^images\//, '')
        : `img-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: 'images',
        public_id: publicId,
      });
      return result.secure_url;
    } catch (error: any) {
      console.error('❌ Cloudinary upload failed:', error.message);
      throw new AppError('Failed to upload image to Cloudinary', 500);
    }
  }

  async uploadBuffer(buffer: Buffer, contentType: string, fileName?: string): Promise<string> {
    if (getStorageProvider() === 'cloudinary') {
      return this.uploadBufferCloudinary(buffer, contentType, fileName);
    }
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
    return this.getSignedUrl(result.Key, 604800);
  }

  private uploadBufferCloudinary(
    buffer: Buffer,
    contentType: string,
    fileName?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const publicId = fileName
        ? fileName.replace(/\.[^.]+$/, '').replace(/^images\//, '')
        : `img-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'images', public_id: publicId },
        (err, result) => {
          if (err) {
            console.error('❌ Cloudinary upload failed:', err.message);
            reject(new AppError('Failed to upload image to Cloudinary', 500));
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new AppError('Cloudinary returned no result', 500));
          }
        }
      );
      upload.end(buffer);
    });
  }

  async getSignedUrl(fileKey: string, expiresIn: number = 604800): Promise<string> {
    if (getStorageProvider() === 'cloudinary') {
      throw new AppError('getSignedUrl not used for Cloudinary (URLs are public)', 400);
    }
    const params = { Bucket: this.bucketName, Key: fileKey, Expires: expiresIn };
    return this.s3.getSignedUrlPromise('getObject', params);
  }

  async uploadLogoPublic(
    buffer: Buffer,
    contentType: string,
    fileName?: string
  ): Promise<{ publicUrl: string; key: string }> {
    if (getStorageProvider() === 'cloudinary') {
      return this.uploadLogoCloudinary(buffer, contentType, fileName);
    }
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
    const signedUrl = await this.getSignedUrl(key, 604800);
    return { publicUrl: signedUrl, key };
  }

  private async uploadLogoCloudinary(
    buffer: Buffer,
    _contentType: string,
    fileName?: string
  ): Promise<{ publicUrl: string; key: string }> {
    return new Promise((resolve, reject) => {
      const publicId = fileName
        ? fileName.replace(/\.[^.]+$/, '').replace(/^logos\//, '')
        : `logo-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'logos', public_id: publicId },
        (err, result) => {
          if (err) {
            console.error('❌ Cloudinary logo upload failed:', err.message);
            reject(new AppError('Failed to upload logo to Cloudinary', 500));
          } else if (result) {
            resolve({ publicUrl: result.secure_url, key: result.public_id });
          } else {
            reject(new AppError('Cloudinary returned no result', 500));
          }
        }
      );
      upload.end(buffer);
    });
  }

  isS3Configured(): boolean {
    const hasCredentials = !!(
      (process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
      (process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)
    );
    const hasBucket = !!(process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME);
    return hasCredentials && hasBucket;
  }

  isCloudinaryConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET)
    );
  }

  async deleteFromS3(fileKey: string): Promise<void> {
    if (getStorageProvider() === 'cloudinary') {
      return this.deleteFromCloudinary(fileKey);
    }
    try {
      await this.s3.deleteObject({ Bucket: this.bucketName, Key: fileKey }).promise();
    } catch (error: any) {
      console.error('❌ Failed to delete from S3:', error.message);
      throw new AppError(`S3 deletion failed: ${error.message}`, 500);
    }
  }

  private async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error('❌ Failed to delete from Cloudinary:', error.message);
      throw new AppError(`Cloudinary deletion failed: ${error.message}`, 500);
    }
  }

  /**
   * Delete a file given its stored URL or key. Silently swallows errors
   * so callers can fire-and-forget without crashing the main flow.
   */
  async deleteFileByUrl(urlOrKey: string): Promise<void> {
    try {
      if (this.isCloudinaryUrl(urlOrKey)) {
        const publicId = this.extractKeyFromUrl(urlOrKey);
        if (publicId) await cloudinary.uploader.destroy(publicId);
        return;
      }
      // For S3 URLs, extract the object key; for raw keys, use as-is
      const key = urlOrKey.startsWith('http')
        ? this.extractKeyFromUrl(urlOrKey)
        : urlOrKey;
      if (key) {
        await this.s3.deleteObject({ Bucket: this.bucketName, Key: key }).promise();
      }
    } catch (err: any) {
      console.error(`⚠️  [Storage] Failed to delete ${urlOrKey}:`, err.message);
    }
  }

  isS3Url(url: string): boolean {
    return url.includes(this.bucketName) || url.includes('t3.storageapi.dev');
  }

  isCloudinaryUrl(url: string): boolean {
    return url.includes('res.cloudinary.com');
  }

  extractKeyFromUrl(url: string): string | null {
    if (this.isCloudinaryUrl(url)) {
      try {
        const u = new URL(url);
        const pathParts = u.pathname.split('/').filter(Boolean);
        const uploadIdx = pathParts.indexOf('upload');
        if (uploadIdx >= 0 && uploadIdx < pathParts.length - 1) {
          const afterUpload = pathParts.slice(uploadIdx + 1);
          const withoutVersion = afterUpload[0]?.startsWith('v') ? afterUpload.slice(1) : afterUpload;
          const keyWithExt = withoutVersion.join('/');
          return keyWithExt ? keyWithExt.replace(/\.[^.]+$/, '') : null;
        }
        return null;
      } catch {
        return null;
      }
    }
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter((p) => p);
      if (parts[0] === this.bucketName) return parts.slice(1).join('/');
      return parts.join('/');
    } catch {
      return null;
    }
  }
}
