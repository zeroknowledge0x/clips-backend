import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EarningsBreakdown,
  EarningsByPeriod,
  EarningsDashboard,
  EarningsHistoryItem,
  UserTotalEarnings,
} from './earnings.types';

type EarningAggregateRow = {
  amount: number;
  source: string | null;
};

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserTotalEarnings(userId: number): Promise<UserTotalEarnings> {
    const earnings = await this.prisma.$transaction((tx) =>
      tx.earning.findMany({
        where: this.userEarningsWhere(userId),
        select: { amount: true, source: true },
      }),
    );

    return this.aggregateEarnings(earnings);
  }

  async getEarningsByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<EarningsByPeriod> {
    this.validatePeriod(startDate, endDate);

    const periodEnd = new Date(endDate);
    periodEnd.setUTCHours(23, 59, 59, 999);

    const earnings = await this.prisma.$transaction((tx) =>
      tx.earning.findMany({
        where: {
          ...this.userEarningsWhere(userId),
          date: { gte: startDate, lte: periodEnd },
        },
        select: {
          id: true,
          amount: true,
          source: true,
          date: true,
          clip: { select: { title: true } },
        },
        orderBy: { date: 'desc' },
      }),
    );

    const aggregated = this.aggregateEarnings(earnings);

    return {
      startDate: startDate.toISOString(),
      endDate: periodEnd.toISOString(),
      total: aggregated.total,
      breakdown: aggregated.breakdown,
      items: earnings.map((earning) => ({
        id: earning.id,
        amount: earning.amount,
        source: earning.source,
        date: earning.date.toISOString(),
        clipTitle: earning.clip.title,
      })),
    };
  }

  async getEarningsDashboard(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<EarningsDashboard> {
    const [totals, snapshot] = await this.prisma.$transaction(async (tx) => {
      const [earnings, payouts] = await Promise.all([
        tx.earning.findMany({
          where: this.userEarningsWhere(userId),
          select: { amount: true, source: true, date: true },
        }),
        tx.payout.findMany({
          where: { userId },
          select: { amount: true, status: true, createdAt: true },
        }),
      ]);

      return [this.aggregateEarnings(earnings), { earnings, payouts }] as const;
    });

    const paidOut = snapshot.payouts
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayout = snapshot.payouts
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    const historyItems: EarningsHistoryItem[] = [
      ...snapshot.earnings.map((e) => ({
        date: e.date.toISOString(),
        amount: e.amount,
        type: e.source as 'royalty' | 'subscription',
      })),
      ...snapshot.payouts.map((p) => ({
        date: p.createdAt.toISOString(),
        amount: p.amount,
        type: 'payout' as const,
      })),
    ];

    historyItems.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const start = (page - 1) * limit;
    const paginatedHistory = historyItems.slice(start, start + limit);

    return {
      totalEarned: totals.total,
      pendingPayout,
      paidOut,
      breakdown: totals.breakdown,
      history: paginatedHistory,
    };
  }

  private userEarningsWhere(userId: number) {
    return { clip: { video: { userId } } };
  }

  private aggregateEarnings(
    earnings: EarningAggregateRow[],
  ): UserTotalEarnings {
    const breakdown = this.computeBreakdown(earnings);
    return {
      total: breakdown.royalties + breakdown.subscriptions,
      breakdown,
    };
  }

  private computeBreakdown(
    earnings: EarningAggregateRow[],
  ): EarningsBreakdown {
    const royalties = earnings
      .filter((e) => e.source === 'royalty')
      .reduce((sum, e) => sum + e.amount, 0);

    const subscriptions = earnings
      .filter((e) => e.source === 'subscription')
      .reduce((sum, e) => sum + e.amount, 0);

    return { royalties, subscriptions };
  }

  private validatePeriod(startDate: Date, endDate: Date): void {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('startDate and endDate must be valid dates');
    }
    if (startDate > endDate) {
      throw new BadRequestException('startDate must be on or before endDate');
    }
  }
}
