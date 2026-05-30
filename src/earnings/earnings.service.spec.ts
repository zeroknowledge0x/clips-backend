import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EarningsService', () => {
  let service: EarningsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    earning: {
      findMany: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EarningsService>(EarningsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEarningsDashboard', () => {
    it('should return empty data when user has no earnings', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);
      mockPrismaService.payout.findMany.mockResolvedValue([]);

      const result = await service.getEarningsDashboard(1);

      expect(result).toEqual({
        totalEarned: 0,
        pendingPayout: 0,
        paidOut: 0,
        breakdown: { royalties: 0, subscriptions: 0 },
        history: [],
      });
    });

    it('should return 200 with earnings data when user has earnings', async () => {
      const earnings = [
        {
          amount: 100,
          source: 'royalty',
          date: new Date('2024-01-01'),
        },
        {
          amount: 50,
          source: 'subscription',
          date: new Date('2024-01-02'),
        },
      ];

      const payouts = [
        {
          amount: 75,
          status: 'completed',
          createdAt: new Date('2024-01-03'),
        },
      ];

      mockPrismaService.earning.findMany.mockResolvedValue(earnings);
      mockPrismaService.payout.findMany.mockResolvedValue(payouts);

      const result = await service.getEarningsDashboard(1);

      expect(result.totalEarned).toBe(150);
      expect(result.paidOut).toBe(75);
      expect(result.breakdown.royalties).toBe(100);
      expect(result.breakdown.subscriptions).toBe(50);
      expect(result.history.length).toBeGreaterThan(0);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);
      mockPrismaService.payout.findMany.mockResolvedValue([]);

      const result = await service.getEarningsDashboard(1, 2, 10);

      expect(result.history).toEqual([]);
    });
  });

  describe('exportEarningsCsv', () => {
    it('returns CSV with headers and earning rows', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([
        {
          id: 7,
          amount: 25.5,
          currency: 'USD',
          date: new Date('2024-06-15T12:00:00.000Z'),
          source: 'royalty',
          clip: { title: 'Viral moment' },
        },
      ]);

      const result = await service.exportEarningsCsv(1, {});

      expect(result.filename).toBe('earnings-export.csv');
      expect(result.content).toContain(
        'date,clip title,amount,currency,source,transactionId',
      );
      expect(result.content).toContain('Viral moment');
      expect(result.content).toContain('royalty');
      expect(result.content).toContain('7');
      expect(mockPrismaService.earning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clip: { video: { userId: 1 } } },
          orderBy: { date: 'asc' },
        }),
      );
    });

    it('filters by date range when startDate and endDate are provided', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);

      await service.exportEarningsCsv(1, {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockPrismaService.earning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('throws when only one date is provided', async () => {
      await expect(
        service.exportEarningsCsv(1, { startDate: '2024-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when startDate is after endDate', async () => {
      await expect(
        service.exportEarningsCsv(1, {
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
