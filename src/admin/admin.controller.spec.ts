import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { ExportReportService } from './export-report.service.js';
import { vi } from 'vitest';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            getProfile: vi.fn(),
            updateProfile: vi.fn(),
            findAll: vi.fn(),
          },
        },
        {
          provide: ExportReportService,
          useValue: {
            exportReport: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
