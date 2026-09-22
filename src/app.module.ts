import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { SpacesModule } from './spaces/spaces.module.js';
import { DiskonModule } from './diskon/diskon.module.js';
import { ReservasiModule } from './reservasi/reservasi.module.js';
import { AdminModule } from './admin/admin.module.js';
import { UploadModule } from './upload/upload.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { BcryptModule } from './bcrypt/bcrypt.module.js';
import { EventsModule } from './events/events.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { MakerKeyMiddleware } from './helper/maker-key.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventsModule,
    PaymentModule,
    AuthModule,
    SpacesModule,
    DiskonModule,
    ReservasiModule,
    AdminModule,
    UploadModule,
    ReviewsModule,
    SchedulerModule,
    PrismaModule,
    BcryptModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MakerKeyMiddleware).forRoutes('*');
  }
}
