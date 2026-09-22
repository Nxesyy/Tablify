import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint: Status API dan Petunjuk Penggunaan
   * GET /
   */
  @Get()
  getApiInfo() {
    return this.appService.getApiInfo();
  }

  /**
   * Health check endpoint: Status kesehatan server & database
   * GET /health
   */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
