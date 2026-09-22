import { Test, TestingModule } from '@nestjs/testing';
import { DiskonController } from './diskon.controller.js';
import { DiskonService } from './diskon.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';

describe('DiskonController', () => {
  let controller: DiskonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiskonController],
      providers: [
        {
          provide: DiskonService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DiskonController>(DiskonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
