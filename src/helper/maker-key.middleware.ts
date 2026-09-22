import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MakerKeyMiddleware implements NestMiddleware {
  private readonly validMakerKey = process.env.MAKER_KEY || 'tablify-maker-key-2026';

  use(req: Request, res: Response, next: NextFunction) {
    // 1. Bypass untuk preflight CORS OPTIONS request
    if (req.method === 'OPTIONS') {
      return next();
    }

    const url = req.originalUrl || req.url;

    // 2. Bypass untuk endpoint public payment (Webhook Xendit & Test-Connection)
    if (url.includes('/payments/webhook') || url.includes('/payments/test-connection')) {
      return next();
    }

    // 3. Bypass untuk root health-check
    if (url === '/' || url === '/api' || url === '/health') {
      return next();
    }

    // 4. Verifikasi header x-maker-key
    const makerKey = req.headers['x-maker-key'];
    if (!makerKey || makerKey !== this.validMakerKey) {
      throw new ForbiddenException(
        'Akses ditolak: Header tenant x-maker-key tidak valid atau tidak disertakan.',
      );
    }

    next();
  }
}
