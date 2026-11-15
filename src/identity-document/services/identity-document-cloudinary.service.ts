import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { EnvConfig } from '@Config';

export interface UploadedIdentityDocument {
  secureUrl: string;
  publicId: string;
}

@Injectable()
export class IdentityDocumentCloudinaryService {
  private readonly configured: boolean;

  constructor(config: ConfigService<EnvConfig, true>) {
    const cloudName = config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = config.get('CLOUDINARY_API_SECRET', { infer: true });
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured) cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  async upload(buffer: Buffer, mimeType: string): Promise<UploadedIdentityDocument> {
    this.ensureConfigured();
    const format = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
    const publicId = `${randomUUID()}.${format}`;
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream({
        folder: 'runaways/documents',
        public_id: publicId,
        resource_type: 'raw',
        type: 'authenticated',
        access_mode: 'authenticated',
        format,
        use_filename: false,
        unique_filename: false,
      }, (error, result) => {
        if (error || !result) {
          reject(new ServiceUnavailableException('No se pudo almacenar el documento. Inténtalo de nuevo.'));
          return;
        }
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      });
      Readable.from(buffer).pipe(upload);
    });
  }

  async delete(publicId: string): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw', type: 'authenticated', invalidate: true });
  }

  async deleteByUrl(secureUrl: string): Promise<void> {
    await this.delete(this.getPublicIdFromUrl(secureUrl));
  }

  private getPublicIdFromUrl(secureUrl: string): string {
    const segments = new URL(secureUrl).pathname.split('/').filter(Boolean);
    const folderIndex = segments.findIndex((part, index) => part === 'runaways' && segments[index + 1] === 'documents');
    const filename = segments.at(-1) ?? '';
    if (folderIndex < 0 || !filename.includes('.')) {
      throw new ServiceUnavailableException('La referencia del documento no es válida.');
    }
    return segments.slice(folderIndex).join('/');
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('El almacenamiento de documentos no está configurado.');
    }
  }
}
