import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import type { EnvConfig } from '@Config';

export interface UploadedImage {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  private readonly configured: boolean;

  constructor(config: ConfigService<EnvConfig, true>) {
    const cloudName = config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = config.get('CLOUDINARY_API_SECRET', { infer: true });
    this.configured = Boolean(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    }
  }

  async upload(buffer: Buffer, mimeType: string): Promise<UploadedImage> {
    this.ensureConfigured();
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'runaways/properties', resource_type: 'image', format: mimeType === 'image/png' ? 'png' : 'jpg' },
        (error, result) => {
          if (error || !result) {
            reject(new ServiceUnavailableException('No se pudo almacenar la imagen. Inténtalo de nuevo.'));
            return;
          }
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(buffer).pipe(upload);
    });
  }

  async delete(publicId: string): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('El almacenamiento de imágenes no está configurado.');
    }
  }
}
