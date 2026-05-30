import {
  BadRequestException,
  Controller,
  UseGuards,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EarningsService } from './earnings.service';
import { Request, Response } from 'express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@UseGuards(JwtAuthGuard)
@Controller('earnings')
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get('export')
  async exportEarnings(
    @Req() req: RequestWithUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format = 'csv',
  ) {
    if (format !== 'csv') {
      throw new BadRequestException('Only format=csv is supported');
    }

    const { filename, content } = await this.earningsService.exportEarningsCsv(
      req.user.userId,
      { startDate, endDate },
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(content);
  }

  @Get()
  async getEarnings(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    return this.earningsService.getEarningsDashboard(
      req.user.userId,
      pageNum,
      limitNum,
    );
  }
}
