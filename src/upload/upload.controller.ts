import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service.js';
import type { UploadedFileType } from './upload.service.js';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 1. Upload Berkas Gambar Umum (PDF No 48: POST /api/upload/image)
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: UploadedFileType) {
    return this.uploadService.uploadFile(file);
  }

  /**
   * 2. Upload Foto Ruangan / Space (PDF No 49: POST /api/upload/spaces)
   */
  @Post('spaces')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadSpaces(@UploadedFile() file: UploadedFileType) {
    return this.uploadService.uploadFile(file);
  }

  /**
   * 3. Upload Foto Profil Member (PDF No 50: POST /api/upload/members)
   */
  @Post('members')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadMembers(@UploadedFile() file: UploadedFileType) {
    return this.uploadService.uploadFile(file);
  }
}
