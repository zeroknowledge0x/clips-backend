import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EarningsService', () => {
  let service: EarningsService;

  const mockPrismaService = {
    earning: {
      findMany: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaService);
        }
        return Promise.all(arg as Promise<unknown>[]);
      },
    );

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserTotalEarnings', () => {
    it('should aggregate royalties and subscriptions', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([
        { amount: 100, source: 'royalty' },
        { amount: 50, source: 'subscription' },
        { amount: 25, source: 'royalty' },
      ]);

      const result = await service.getUserTotalEarnings(1);

      expect(result.total).toBe(175);
      expect(result.breakdown).toEqual({
        royalties: 125,
        subscriptions: 50,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should return zero totals when user has no earnings', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([]);

      const result = await service.getUserTotalEarnings(1);

      expect(result).toEqual({
        total: 0,
        breakdown: { royalties: 0, subscriptions: 0 },
      });
    });
  });

  describe('getEarningsByPeriod', () => {
    it('should return earnings within the date range', async () => {
      mockPrismaService.earning.findMany.mockResolvedValue([
        {
          id: 1,
          amount: 80,
          source: 'royalty',
          date: new Date('2024-06-01T00:00:00.000Z'),
          clip: { title: 'Summer clip' },
        },
      ]);

      const result = await service.getEarningsByPeriod(
        1,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result.total).toBe(80);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].clipTitle).toBe('Summer clip');
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

    it('should throw when startDate is after endDate', async () => {
      await expect(
        service.getEarningsByPeriod(
          1,
          new Date('2024-12-31'),
          new Date('2024-01-01'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
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
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should return earnings data when user has earnings', async () => {
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
});
