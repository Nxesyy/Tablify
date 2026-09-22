import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aktifkan CORS dinamis agar kompatibel dengan credentials: true pada browser
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-maker-key',
      'x-callback-token',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
  });

  // Tambahkan limit body parser untuk mendukung payload gambar base64 hingga 25MB
  const express = await import('express');
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Dukung format endpoint standar UKK (/api/...) maupun tanpa awalan (/...)
  app.use((req: any, res: any, next: any) => {
    if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.substring(4);
    }
    next();
  });

  // Aktifkan validasi DTO secara global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Tablify Backend running on http://localhost:${port}`);
}
await bootstrap();
