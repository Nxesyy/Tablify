import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { vi } from 'vitest';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            space_owner: {
              findFirst: vi.fn(),
              findUnique: vi.fn(),
              update: vi.fn(),
            },
            member: {
              findMany: vi.fn(),
            },
          },
        },
        {
          provide: (await import('../bcrypt/bcrypt.service.js')).BcryptService,
          useValue: {
            hashPassword: vi.fn(),
            comparePassword: vi.fn(),
          },
        },
        {
          provide: (await import('../spaces/spaces.service.js')).SpacesService,
          useValue: {},
        },
        {
          provide: (await import('../diskon/diskon.service.js')).DiskonService,
          useValue: {},
        },
        {
          provide: (await import('../reservasi/reservasi.service.js')).ReservasiService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
