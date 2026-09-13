import { PartialType } from '@nestjs/mapped-types';
import { CreateSpaceDto } from './create-space.dto.js';

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {}
