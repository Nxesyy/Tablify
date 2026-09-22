import { Test, TestingModule } from '@nestjs/testing';
import { SpacesController } from './spaces.controller.js';
import { SpacesService } from './spaces.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';

describe('SpacesController', () => {
  let controller: SpacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpacesController],
      providers: [
        {
          provide: SpacesService,
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

    controller = module.get<SpacesController>(SpacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
