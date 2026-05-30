import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildEarningsCsv } from './earnings-csv.util';

export interface EarningsExportOptions {
  startDate?: string;
  endDate?: string;
}

export interface EarningsExportResult {
  filename: string;
  content: string;
}

export interface EarningsBreakdown {
  royalties: number;
  subscriptions: number;
}

export interface EarningsHistoryItem {
  date: string;
  amount: number;
  type: 'royalty' | 'subscription' | 'payout';
}

export interface EarningsDashboard {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  breakdown: EarningsBreakdown;
  history: EarningsHistoryItem[];
}

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private prisma: PrismaService) {}

  async getEarningsDashboard(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<EarningsDashboard> {
    const earnings = await this.prisma.earning.findMany({
      where: { clip: { video: { userId } } },
      select: { amount: true, source: true, date: true },
    });

    const royalties = earnings
      .filter((e) => e.source === 'royalty')
      .reduce((sum, e) => sum + e.amount, 0);

    const subscriptions = earnings
      .filter((e) => e.source === 'subscription')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalEarned = royalties + subscriptions;

    const payouts = await this.prisma.payout.findMany({
      where: { userId },
      select: { amount: true, status: true, createdAt: true },
    });

    const paidOut = payouts
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayout = payouts
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    const historyItems: EarningsHistoryItem[] = [
      ...earnings.map((e) => ({
        date: e.date.toISOString(),
        amount: e.amount,
        type: e.source as 'royalty' | 'subscription',
      })),
      ...payouts.map((p) => ({
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
      totalEarned,
      pendingPayout,
      paidOut,
      breakdown: {
        royalties,
        subscriptions,
      },
      history: paginatedHistory,
    };
  }

  async exportEarningsCsv(
    userId: number,
    options: EarningsExportOptions,
  ): Promise<EarningsExportResult> {
    const dateRange = this.parseExportDateRange(
      options.startDate,
      options.endDate,
    );

    const earnings = await this.prisma.earning.findMany({
      where: {
        clip: { video: { userId } },
        ...(dateRange
          ? { date: { gte: dateRange.start, lte: dateRange.end } }
          : {}),
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        date: true,
        source: true,
        clip: { select: { title: true } },
      },
      orderBy: { date: 'asc' },
    });

    const rows = earnings.map((earning) => [
      earning.date.toISOString(),
      earning.clip.title ?? '',
      earning.amount,
      earning.currency,
      earning.source ?? '',
      String(earning.id),
    ]);

    const filename = this.buildExportFilename(dateRange);
    return {
      filename,
      content: buildEarningsCsv(rows),
    };
  }

  private parseExportDateRange(
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } | null {
    if (!startDate && !endDate) {
      return null;
    }
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Both startDate and endDate are required for a custom date range',
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'startDate and endDate must be valid ISO date strings',
      );
    }
    if (start > end) {
      throw new BadRequestException('startDate must be on or before endDate');
    }

    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  private buildExportFilename(
    dateRange: { start: Date; end: Date } | null,
  ): string {
    if (!dateRange) {
      return 'earnings-export.csv';
    }
    const start = dateRange.start.toISOString().slice(0, 10);
    const end = dateRange.end.toISOString().slice(0, 10);
    return `earnings-export-${start}-to-${end}.csv`;
  }
}
