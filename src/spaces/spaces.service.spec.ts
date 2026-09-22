import { Test, TestingModule } from '@nestjs/testing';
import { SpacesService } from './spaces.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SpacesService', () => {
  let service: SpacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
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

    service = module.get<SpacesService>(SpacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
