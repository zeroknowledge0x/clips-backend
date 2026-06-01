import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayoutsService } from './payouts.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@ApiTags('payout')
@ApiBearerAuth('access-token')
@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request a payout for earned balance' })
  @ApiResponse({ status: 201, description: 'Payout requested' })
  @ApiResponse({ status: 400, description: 'Pending payout already exists or insufficient balance' })
  async requestPayout(@Req() req: RequestWithUser) {
    return this.payoutsService.requestPayout(req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List payouts for the authenticated user' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by payout status' })
  @ApiResponse({ status: 200, description: 'List of payouts' })
  async listPayouts(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
  ) {
    return this.payoutsService.getPayouts(req.user.userId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payout by ID' })
  @ApiParam({ name: 'id', description: 'Payout ID' })
  @ApiResponse({ status: 200, description: 'Payout details' })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  async getPayout(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.payoutsService.getPayoutById(req.user.userId, id);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a payout (trigger Stellar transfer)' })
  @ApiParam({ name: 'id', description: 'Payout ID' })
  @ApiResponse({ status: 200, description: 'Payout processed' })
  async processPayout(@Param('id') id: string) {
    return this.payoutsService.processPayout(parseInt(id, 10));
  }
}
