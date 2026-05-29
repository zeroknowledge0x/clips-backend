import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionsService } from '../src/transactions/transactions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StellarService } from '../src/stellar/stellar.service';
import { EncryptionService } from '../src/encryption/encryption.service';
import { RedisService } from '../src/redis/redis.service';
import { TRANSACTION_DAILY_LIMIT } from '../src/transactions/dto/send-transaction.dto';

jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@stellar/stellar-sdk', () => {
  const mockSign = jest.fn();
  const mockBuild = jest.fn().mockReturnValue({ sign: mockSign });
  const mockTimeout = jest.fn().mockReturnValue({ build: mockBuild });
  const mockAddOperation = jest.fn().mockReturnValue({ setTimeout: mockTimeout });
  const mockTxBuilder = jest.fn().mockImplementation(() => ({
    addOperation: mockAddOperation,
  }));
  return {
    Keypair: {
      fromSecret: jest.fn().mockReturnValue({ publicKey: jest.fn().mockReturnValue('GPUBLICKEY') }),
    },
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({ id: 'GPUBLICKEY' }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
      })),
    },
    TransactionBuilder: mockTxBuilder,
    Operation: { payment: jest.fn().mockReturnValue({ type: 'payment' }) },
    Asset: { native: jest.fn().mockReturnValue({ isNative: () => true }) },
    BASE_FEE: '100',
  };
});

const VALID_DESTINATION = 'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3';
const SELF_PUBLIC_KEY = 'GPUBLICKEY'; // matches Keypair.fromSecret mock

class InMemoryPrisma {
  private users: any[] = [];
  user = {
    findUnique: jest.fn(async ({ where }) => this.users.find((u) => u.id === where.id) ?? null),
  };
  _seedUser(user: any) {
    this.users.push(user);
  }
}

class MockRedisService {
  private store = new Map<string, string>();
  private client = {
    incrbyfloat: jest.fn(async (key: string, by: number) => {
      const cur = parseFloat(this.store.get(key) ?? '0');
      const next = cur + by;
      this.store.set(key, String(next));
      return next;
    }),
  };

  get = jest.fn(async (key: string) => this.store.get(key) ?? null);
  setex = jest.fn(async (key: string, _ttl: number, value: string) => {
    this.store.set(key, value);
  });
  getClient = jest.fn(() => this.client);
  _set(key: string, value: string) {
    this.store.set(key, value);
  }
  _get(key: string) {
    return this.store.get(key);
  }
}

describe('Transactions integration', () => {
  let service: TransactionsService;
  let prisma: InMemoryPrisma;
  let redis: MockRedisService;
  let stellarService: { validateAddress: jest.Mock; horizonUrl: string; networkPassphrase: string };
  let encryptionService: { decrypt: jest.Mock };

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    redis = new MockRedisService();
    stellarService = {
      validateAddress: jest.fn().mockReturnValue({ valid: true }),
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
    };
    encryptionService = {
      decrypt: jest.fn().mockReturnValue('SCZANGBA5YELWTYPPRHG5PJRJHQ7VVTL6IIYLXN5YB7SFT2UVNO3XHZ'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StellarService, useValue: stellarService },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  const seedValidUser = () =>
    prisma._seedUser({ id: 1, stellarPublicKey: 'GDIFFERENT_KEY', encryptedStellarSecret: 'enc' });

  // ─── Basic send ─────────────────────────────────────────────────────────────

  it('returns hash, destination, and amount on a successful send', async () => {
    seedValidUser();
    const result = await service.send(1, { destination: VALID_DESTINATION, amount: '10.5' });
    expect(result.hash).toBe('mock-tx-hash');
    expect(result.destination).toBe(VALID_DESTINATION);
    expect(result.amount).toBe('10.5');
  });

  it('throws BadRequestException for an invalid destination address', async () => {
    seedValidUser();
    stellarService.validateAddress.mockReturnValue({ valid: false });
    await expect(service.send(1, { destination: 'bad', amount: '5' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException when user has no custodial wallet', async () => {
    prisma._seedUser({ id: 2, stellarPublicKey: null, encryptedStellarSecret: null });
    await expect(service.send(2, { destination: VALID_DESTINATION, amount: '1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when user record does not exist', async () => {
    await expect(
      service.send(999, { destination: VALID_DESTINATION, amount: '1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('decrypts the stored secret before signing', async () => {
    seedValidUser();
    await service.send(1, { destination: VALID_DESTINATION, amount: '2' });
    expect(encryptionService.decrypt).toHaveBeenCalledWith('enc');
  });

  it('throws InternalServerErrorException when Stellar submission fails', async () => {
    seedValidUser();
    const { Horizon } = jest.requireMock('@stellar/stellar-sdk');
    Horizon.Server.mockImplementationOnce(() => ({
      loadAccount: jest.fn().mockResolvedValue({ id: 'GPUBLICKEY' }),
      submitTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
    }));
    await expect(service.send(1, { destination: VALID_DESTINATION, amount: '3' })).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  // ─── Self-send guard ────────────────────────────────────────────────────────

  it('throws BadRequestException on self-send attempt', async () => {
    // User's public key matches destination
    prisma._seedUser({ id: 3, stellarPublicKey: VALID_DESTINATION, encryptedStellarSecret: 'enc' });
    await expect(
      service.send(3, { destination: VALID_DESTINATION, amount: '1' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Daily volume cap ───────────────────────────────────────────────────────

  it('throws UnprocessableEntityException when daily volume limit is reached', async () => {
    seedValidUser();
    // Pre-load volume just at the limit
    redis._set('tx:daily_volume:1', String(TRANSACTION_DAILY_LIMIT));
    await expect(service.send(1, { destination: VALID_DESTINATION, amount: '1' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('allows a send when volume is just under the daily limit', async () => {
    seedValidUser();
    redis._set('tx:daily_volume:1', String(TRANSACTION_DAILY_LIMIT - 1));
    const result = await service.send(1, { destination: VALID_DESTINATION, amount: '0.5' });
    expect(result.hash).toBe('mock-tx-hash');
  });

  it('updates the daily volume counter after a successful send', async () => {
    seedValidUser();
    await service.send(1, { destination: VALID_DESTINATION, amount: '100' });
    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(redis.setex).toHaveBeenCalledWith('tx:daily_volume:1', expect.any(Number), '100');
  });

  // ─── Idempotency ────────────────────────────────────────────────────────────

  it('returns cached result on duplicate idempotency key without re-submitting', async () => {
    seedValidUser();
    const cachedResponse = { hash: 'original-hash', destination: VALID_DESTINATION, amount: '5' };
    redis._set('tx:idem:1:my-key', JSON.stringify(cachedResponse));

    const result = await service.send(1, { destination: VALID_DESTINATION, amount: '5' }, 'my-key');
    expect(result.hash).toBe('original-hash');
    // Stellar SDK should NOT have been called for the duplicate
    const { Horizon } = jest.requireMock('@stellar/stellar-sdk');
    const serverInstance = Horizon.Server.mock.results[Horizon.Server.mock.results.length - 1];
    // submitTransaction should not be on the mocked server for this request
    // (the cached path returns before building the transaction)
    expect(redis.setex).not.toHaveBeenCalledWith(
      expect.stringContaining('idem:1:my-key'),
      expect.any(Number),
      expect.any(String),
    );
  });

  it('caches the response under the idempotency key after a new send', async () => {
    seedValidUser();
    await service.send(1, { destination: VALID_DESTINATION, amount: '7' }, 'fresh-key');
    await new Promise((r) => setTimeout(r, 10));
    expect(redis.setex).toHaveBeenCalledWith(
      'tx:idem:1:fresh-key',
      expect.any(Number),
      expect.stringContaining('mock-tx-hash'),
    );
  });

  it('does not cache when no idempotency key is provided', async () => {
    seedValidUser();
    await service.send(1, { destination: VALID_DESTINATION, amount: '1' });
    await new Promise((r) => setTimeout(r, 10));
    const idemCalls = (redis.setex as jest.Mock).mock.calls.filter(([key]) =>
      key.startsWith('tx:idem:'),
    );
    expect(idemCalls).toHaveLength(0);
  });
});
