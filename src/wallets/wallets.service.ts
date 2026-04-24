import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DisconnectResult {
  message: string;
  walletId: number;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soft-delete a wallet by setting `deletedAt`.
   *
   * Guards:
   *  - Wallet must exist and belong to the requesting user
   *  - Wallet must not already be disconnected
   *  - No pending payouts may reference this wallet
   *  - (Future) No active NFTs — add check here when NFT model is persisted
   */
  async disconnect(walletId: number, userId: number): Promise<DisconnectResult> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.userId !== userId) {
      // Treat missing + wrong-owner the same to avoid leaking existence
      throw new NotFoundException(`Wallet ${walletId} not found`);
    }

    if (wallet.deletedAt !== null) {
      throw new ConflictException('Wallet is already disconnected');
    }

    // Block if any payout linked to this wallet is still pending
    const pendingPayout = await this.prisma.payout.findFirst({
      where: { walletId, status: 'pending' },
    });

    if (pendingPayout) {
      throw new ConflictException(
        'Cannot disconnect wallet: there are pending payouts attached to it',
      );
    }

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });

    return {
      message: 'Wallet disconnected successfully',
      walletId,
    };
  }
}
