import cloudinary from 'cloudinary';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';
import multer from 'multer';
import path from 'path';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
  fileInfo?: {
    originalName: string;
    size: number;
    format: string;
    width?: number;
    height?: number;
  };
}

interface UploadOptions {
  folder?: string;
  transformation?: any;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  allowedFormats?: string[];
  maxFileSize?: number;
  quality?: 'auto' | number;
  compression?: boolean;
}

class UploadService {
  private allowedImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  private allowedDocumentTypes = ['pdf', 'doc', 'docx', 'txt'];
  private maxFileSizeDefault = config.MAX_FILE_SIZE; // 5MB default

  constructor() {
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await cloudinary.v2.api.ping();
      logger.info('Cloudinary connection verified successfully');
    } catch (error) {
      logger.error('Cloudinary connection failed:', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private validateFile(file: Express.Multer.File, options: UploadOptions = {}): string | null {
    const allowedFormats = options.allowedFormats || [...this.allowedImageTypes, ...this.allowedDocumentTypes];
    const maxSize = options.maxFileSize || this.maxFileSizeDefault;

    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds limit of ${maxSize / (1024 * 1024)}MB`;
    }

    // Check file type
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    if (!allowedFormats.includes(fileExtension)) {
      return `File type .${fileExtension} is not allowed. Allowed types: ${allowedFormats.join(', ')}`;
    }

    // Check MIME type
    const allowedMimeTypes = config.ALLOWED_FILE_TYPES.split(',');
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return `MIME type ${file.mimetype} is not allowed`;
    }

    return null;
  }

  async uploadFile(file: Express.Multer.File, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // Validate file
      const validationError = this.validateFile(file, options);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      // Determine upload parameters
      const uploadOptions: any = {
        folder: options.folder || 'app-telas-magicas',
        resource_type: options.resourceType || 'auto',
        quality: options.quality || 'auto',
        transformation: options.transformation,
      };

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(file.buffer);
      }) as any;

      logger.info('File uploaded successfully to Cloudinary', {
        publicId: result.public_id,
        originalName: file.originalname,
        size: file.size,
        format: result.format,
        url: result.secure_url,
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          format: result.format,
          width: result.width,
          height: result.height,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      logger.error('File upload failed:', {
        error: errorMessage,
        fileName: file.originalname,
        fileSize: file.size,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async uploadProfileImage(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    return this.uploadFile(file, {
      folder: `app-telas-magicas/profiles/${userId}`,
      resourceType: 'image',
      allowedFormats: this.allowedImageTypes,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', format: 'webp' }
      ],
      quality: 80,
    });
  }

  async uploadDocumentFile(file: Express.Multer.File, userId: string, documentType: string): Promise<UploadResult> {
    return this.uploadFile(file, {
      folder: `app-telas-magicas/documents/${userId}/${documentType}`,
      resourceType: 'raw',
      allowedFormats: this.allowedDocumentTypes,
      maxFileSize: 10 * 1024 * 1024, // 10MB for documents
    });
  }

  async uploadAppointmentAttachment(file: Express.Multer.File, appointmentId: string): Promise<UploadResult> {
    return this.uploadFile(file, {
      folder: `app-telas-magicas/appointments/${appointmentId}`,
      resourceType: 'auto',
      maxFileSize: 5 * 1024 * 1024, // 5MB for attachments
    });
  }

  async deleteFile(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.v2.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        logger.info('File deleted successfully from Cloudinary', { publicId });
        return true;
      } else {
        logger.warn('File deletion was not successful', { publicId, result });
        return false;
      }
    } catch (error) {
      logger.error('File deletion failed:', {
        error: error instanceof Error ? error.message : error,
        publicId,
      });
      return false;
    }
  }

  async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.v2.api.resource(publicId);
      return result;
    } catch (error) {
      logger.error('Error getting file info:', {
        error: error instanceof Error ? error.message : error,
        publicId,
      });
      return null;
    }
  }

  async listFiles(folder: string, maxResults: number = 50): Promise<any[]> {
    try {
      const result = await cloudinary.v2.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
        resource_type: 'image',
      });
      return result.resources || [];
    } catch (error) {
      logger.error('Error listing files:', {
        error: error instanceof Error ? error.message : error,
        folder,
      });
      return [];
    }
  }

  // Generate optimized image URLs
  generateOptimizedUrl(publicId: string, options: {
    width?: number;
    height?: number;
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    crop?: string;
  } = {}): string {
    return cloudinary.v2.url(publicId, {
      width: options.width,
      height: options.height,
      quality: options.quality || 'auto',
      format: options.format || 'auto',
      crop: options.crop || 'scale',
      secure: true,
    });
  }

  // Create multer middleware for file uploads
  createUploadMiddleware(options: {
    maxFiles?: number;
    maxFileSize?: number;
    allowedTypes?: string[];
  } = {}) {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: options.maxFileSize || this.maxFileSizeDefault,
        files: options.maxFiles || 5,
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = options.allowedTypes || [...this.allowedImageTypes, ...this.allowedDocumentTypes];
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
        
        if (allowedTypes.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new Error(`File type .${fileExtension} is not allowed`));
        }
      },
    });
  }

  // Bulk file operations
  async uploadMultipleFiles(files: Express.Multer.File[], options: UploadOptions = {}): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const file of files) {
      const result = await this.uploadFile(file, options);
      results.push(result);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  async deleteMultipleFiles(publicIds: string[]): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;
    
    for (const publicId of publicIds) {
      const result = await this.deleteFile(publicId);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return { successful, failed };
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byResourceType: any;
  } | null> {
    try {
      const result = await cloudinary.v2.api.usage();
      return {
        totalFiles: result.resources,
        totalSize: result.bytes,
        byResourceType: result.resources_by_type,
      };
    } catch (error) {
      logger.error('Error getting storage stats:', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;