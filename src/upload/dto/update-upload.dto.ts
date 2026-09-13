import { PartialType } from '@nestjs/mapped-types';
import { CreateUploadDto } from './create-upload.dto.js';

export class UpdateUploadDto extends PartialType(CreateUploadDto) {}
