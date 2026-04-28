# Quick Start Guide - Platform Fee Tracking

## TL;DR

This smart contract tracks all platform fees (5% of NFT sales) in a public, transparent way.

## Quick Commands

```bash
# Build contract
cd contracts/nft-royalty
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test

# Deploy to testnet
./scripts/deploy.sh testnet

# Query platform revenue (after backend is running)
curl http://localhost:3000/platform/revenue
```

## Key Functions

### Smart Contract

```rust
// Execute a royalty payment (automatically tracks platform fee)
execute_royalty_payment(
    token_id: u128,
    sale_price: i128,
    payment_token: Address,
    buyer: Address,
    platform_wallet: Address
)

// Get total platform revenue (public, read-only)
get_platform_revenue() -> u128
```

### Backend API

```bash
# Get platform revenue
GET /platform/revenue

# Response
{
  "totalFeesStroops": "50000000",
  "totalFeesXLM": "5.0000000",
  "lastUpdated": "2026-04-28T10:30:00.000Z"
}
```

## How It Works

1. User buys an NFT for 100 XLM
2. Contract calculates:
   - Royalty: 10% = 10 XLM → creator
   - Platform fee: 5% = 5 XLM → platform
   - Seller gets: 85 XLM
3. Contract updates `total_platform_fees += 5 XLM`
4. Emits `PlatformFeeCollected` event
5. Anyone can query total via `get_platform_revenue()`

## Example Flow

```rust
// Mint NFT with 10% royalty
mint(creator, 1, "ipfs://...", creator, 1000);

// Execute sale: 100 XLM
execute_royalty_payment(
    1,                    // token_id
    1_000_000_000,       // 100 XLM in stroops
    payment_token,
    buyer,
    platform_wallet
);

// Query total fees
let total = get_platform_revenue();
// Returns: 50_000_000 (5 XLM in stroops)
```

## Testing

```bash
cargo test test_platform_fee_tracking
```

Expected output:
```
test test::test_platform_fee_tracking ... ok
```

## Verification Checklist

- [ ] Contract builds without errors
- [ ] Tests pass
- [ ] Contract deployed to testnet
- [ ] Backend can query `get_platform_revenue()`
- [ ] API endpoint returns revenue data
- [ ] Events are emitted on fee collection

## Constants

- Platform fee: 5% (500 BPS)
- Max royalty: 15% (1500 BPS)
- 1 XLM = 10,000,000 stroops

## Files to Know

- `src/lib.rs` - Main contract code
- `Cargo.toml` - Dependencies
- `scripts/deploy.sh` - Deployment script
- `PLATFORM_FEE_TRACKING.md` - Detailed docs
- `README.md` - Full documentation

## Need Help?

See `PLATFORM_FEE_TRACKING.md` for detailed implementation guide.
