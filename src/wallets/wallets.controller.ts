import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletsService, DisconnectResult } from './wallets.service';

interface AuthRequest extends Request {
  user: { userId: number; email: string | null };
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /**
   * DELETE /wallets/:id
   *
   * Soft-deletes the wallet (sets deletedAt).
   * Blocked if pending payouts exist on the wallet.
   * Returns 404 for wallets that don't exist or belong to another user.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ): Promise<DisconnectResult> {
    return this.walletsService.disconnect(id, req.user.userId);
  }
}
