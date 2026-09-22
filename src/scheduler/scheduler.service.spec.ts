import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchedulerService } from './scheduler.service.js';
import { ReminderNotificationService } from './reminder-notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: PrismaService;

  const mockPrisma = {
    reservasi: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockReminderService = {
    notifyUpcomingBooking: vi.fn(),
    notifySessionEnding: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ReminderNotificationService,
          useValue: mockReminderService,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    prisma = module.get<PrismaService>(PrismaService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('harus memproses smart reminder pengingat waktu mulai', async () => {
    const upcomingList = [
      {
        id: 101,
        kode_tiket: 'TBL-UPCOMING-01',
        status: 'Disetujui',
        member: { nama_member: 'Siti' },
        detailReservasi: { space: { nama_space: 'Private Office 1' } },
      },
    ];

    mockPrisma.reservasi.findMany.mockResolvedValueOnce(upcomingList); // Upcoming query
    mockPrisma.reservasi.findMany.mockResolvedValueOnce([]); // Ending query

    await service.handleSmartReminders();

    expect(mockReminderService.notifyUpcomingBooking).toHaveBeenCalledWith(upcomingList[0]);
  });
});
