import { Global, Module } from '@nestjs/common';
import { BcryptService } from './bcrypt.service.js';

@Global()
@Module({
  providers: [BcryptService],
  exports: [BcryptService],
})
export class BcryptModule {}
