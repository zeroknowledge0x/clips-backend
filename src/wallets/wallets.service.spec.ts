import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  wallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payout: {
    findFirst: jest.fn(),
  },
};

const baseWallet = {
  id: 1,
  userId: 42,
  address: 'GXYZ',
  chain: 'stellar',
  type: 'custodial',
  deletedAt: null,
  connectedAt: new Date(),
  updatedAt: new Date(),
};

describe('WalletsService.disconnect', () => {
  let service: WalletsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<WalletsService>(WalletsService);
  });

  it('throws NotFoundException when wallet does not exist', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(null);
    await expect(service.disconnect(99, 42)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when wallet belongs to another user', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({ ...baseWallet, userId: 99 });
    await expect(service.disconnect(1, 42)).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when wallet is already disconnected', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue({
      ...baseWallet,
      deletedAt: new Date(),
    });
    await expect(service.disconnect(1, 42)).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when pending payouts exist', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
    mockPrisma.payout.findFirst.mockResolvedValue({ id: 5, status: 'pending' });
    await expect(service.disconnect(1, 42)).rejects.toThrow(ConflictException);
  });

  it('soft-deletes the wallet and returns success message', async () => {
    mockPrisma.wallet.findUnique.mockResolvedValue(baseWallet);
    mockPrisma.payout.findFirst.mockResolvedValue(null);
    mockPrisma.wallet.update.mockResolvedValue({ ...baseWallet, deletedAt: new Date() });

    const result = await service.disconnect(1, 42);

    expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    });
    expect(result).toEqual({ message: 'Wallet disconnected successfully', walletId: 1 });
  });
});
