import { Test, TestingModule } from '@nestjs/testing';
import { ReservasiController } from './reservasi.controller.js';
import { ReservasiService } from './reservasi.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';

describe('ReservasiController', () => {
  let controller: ReservasiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservasiController],
      providers: [
        {
          provide: ReservasiService,
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

    controller = module.get<ReservasiController>(ReservasiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
