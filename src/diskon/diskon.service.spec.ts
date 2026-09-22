import { Test, TestingModule } from '@nestjs/testing';
import { DiskonService } from './diskon.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('DiskonService', () => {
  let service: DiskonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiskonService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DiskonService>(DiskonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
