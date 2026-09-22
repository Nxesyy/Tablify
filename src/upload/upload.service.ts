import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedFileType {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SCREAT || process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: UploadedFileType) {
    if (!file) {
      throw new BadRequestException('File gambar wajib diunggah');
    }

    // Sanitasi tipe file (Hanya izinkan gambar JPG, PNG, WEBP)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format berkas tidak didukung. Harap unggah gambar JPG, PNG, atau WEBP',
      );
    }

    // Batasi ukuran maksimal 15MB
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Ukuran gambar maksimal adalah 15MB');
    }

    // Jika kredensial Cloudinary sudah diisi di .env
    const isCloudinaryConfigured =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      (process.env.CLOUDINARY_API_SCREAT || process.env.CLOUDINARY_API_SECRET);

    if (isCloudinaryConfigured) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'tablify' },
          (error, result) => {
            if (error) {
              return reject(new BadRequestException(`Gagal upload ke Cloudinary: ${error.message}`));
            }
            const uploadedUrl = result?.secure_url || '';
            const filename = result?.public_id ? `${result.public_id.split('/').pop()}` : file.originalname;
            resolve({
              status: true,
              statusCode: 201,
              message: 'File berhasil diupload',
              success: true,
              url: uploadedUrl,
              public_id: result?.public_id,
              data: {
                filename,
                original_name: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                url: uploadedUrl,
              },
              timestamp: new Date().toISOString(),
            });
          },
        );
        uploadStream.end(file.buffer);
      });
    }

    // Fallback: Mengembalikan base64 data URL jika Cloudinary belum disetting
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return {
      status: true,
      statusCode: 201,
      message: 'File berhasil diproses (Base64 data URL)',
      success: true,
      url: base64Data,
      data: {
        filename: file.originalname,
        original_name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: base64Data,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
