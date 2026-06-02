import { NftOwnershipService } from '../src/nft/nft-ownership.service';
import { StellarService } from '../src/stellar/stellar.service';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('Soroban TypeScript Bindings Integration', () => {
  let service: NftOwnershipService;
  let stellarService: StellarService;

  const mockStellarService = {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  };

  beforeEach(() => {
    service = new NftOwnershipService(mockStellarService as any);
  });

  it('should verify NFT ownership using Soroban bindings', async () => {
    const result = await service.verifyNFTOwnership(
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEU4',
      'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3',
    );
    expect(result).toHaveProperty('isOwner');
    expect(typeof result.isOwner).toBe('boolean');
  });
});
