import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewsService } from './reviews.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    member: {
      findUnique: vi.fn(),
    },
    reservasi: {
      findUnique: vi.fn(),
    },
    review: {
      create: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    space: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('harus menolak ulasan jika status reservasi bukan selesai', async () => {
    mockPrismaService.member.findUnique.mockResolvedValue({ id: 1, id_user: 10 });
    mockPrismaService.reservasi.findUnique.mockResolvedValue({
      id: 100,
      id_member: 1,
      status: 'dibatalkan',
      detailReservasi: { id_space: 5 },
      review: null,
    });

    await expect(
      service.createReview(
        { id_reservasi: 100, rating: 5, komentar: 'Bagus' },
        10,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus menolak ulasan jika reservasi milik orang lain', async () => {
    mockPrismaService.member.findUnique.mockResolvedValue({ id: 2, id_user: 20 });
    mockPrismaService.reservasi.findUnique.mockResolvedValue({
      id: 100,
      id_member: 1,
      status: 'selesai',
      detailReservasi: { id_space: 5 },
      review: null,
    });

    await expect(
      service.createReview(
        { id_reservasi: 100, rating: 5, komentar: 'Bagus' },
        20,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('harus menolak jika tiket sudah pernah diberi ulasan sebelumnya', async () => {
    mockPrismaService.member.findUnique.mockResolvedValue({ id: 1, id_user: 10 });
    mockPrismaService.reservasi.findUnique.mockResolvedValue({
      id: 100,
      id_member: 1,
      status: 'selesai',
      detailReservasi: { id_space: 5 },
      review: { id: 1, rating: 5 },
    });

    await expect(
      service.createReview(
        { id_reservasi: 100, rating: 4, komentar: 'Bagus lagi' },
        10,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
