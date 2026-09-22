import { Test, TestingModule } from '@nestjs/testing';
import { ReservasiService } from './reservasi.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ReservasiService', () => {
  let service: ReservasiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasiService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: (await import('../events/events.service.js')).EventsService,
          useValue: { emit: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<ReservasiService>(ReservasiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
