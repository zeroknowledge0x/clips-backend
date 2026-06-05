# Wallet Integration Flow

This document describes the end-to-end flow for connecting a Stellar wallet and interacting with the Soroban NFT royalty contract, from frontend user action through backend processing to on-chain execution.

## Overview

The integration involves three main components:
1. **Frontend** (user interface, wallet connector)
2. **Backend API** (NestJS/Node.js services)
3. **Soroban Network** (Stellar blockchain + smart contracts)

The backend acts as an orchestrator: it validates inputs, prepares transaction XDR, and interacts with Soroban RPC, but **never handles user private keys**. All signing happens client-side.

## Flow Diagrams

### 1. Wallet Connection Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB
    participant StellarNetwork

    User->>Frontend: Clicks "Connect Wallet"
    Frontend->>Wallet Extension: Request Stellar address (Freighter/Lobstr/Albedo)
    Wallet Extension-->>Frontend: Returns address + chain type
    Frontend->>Backend: POST /wallets/connect {address, type}
    Backend->>Backend: Validate address format (Ed25519)
    Backend->>Backend: Check if address already exists
    Backend->>DB: Upsert wallet record (reactivate if soft-deleted)
    Backend-->>Frontend: 200 OK + wallet ID
    Frontend->>User: Show connected wallet
```

### 2. NFT Mint Flow (Two-Step)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant IPFS
    participant SorobanRPC
    participant SorobanContract

    User->>Frontend: Selects clip to mint
    Frontend->>Backend: POST /nfts/prepare-mint {clipId, walletAddress}
    Backend->>Backend: Validate clip ownership
    Backend->>Backend: Ensure clip not already minted
    Backend->>IPFS: Upload metadata (if needed)
    Backend->>Backend: Build Soroban mint transaction (XDR)
    Backend->>Backend: Include royalty map (creator + platform)
    Backend-->>Frontend: Returns XDR + metadata
    Frontend->>Wallet Extension: Sign XDR with user wallet
    Wallet Extension-->>Frontend: Signed transaction
    Frontend->>SorobanRPC: Submit signed transaction
    SorobanRPC->>SorobanContract: Execute mint() call
    SorobanContract-->>SorobanRPC: Result (success/error)
    SorobanRPC-->>Frontend: Transaction hash
    Frontend->>User: Show success + view NFT
```

### 3. Royalty Query Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Redis
    participant SorobanRPC
    participant SorobanContract

    User->>Frontend: Views NFT detail page
    Frontend->>Backend: GET /nfts/:tokenId/royalty
    Backend->>Redis: Check cached royalty
    alt Cache hit
        Redis-->>Backend: Cached royaltyBps + recipient
    else Cache miss
        Backend->>SorobanRPC: Call batch_royalty_info (or single)
        SorobanRPC->>SorobanContract: Read royalty state
        SorobanContract-->>SorobanRPC: RoyaltyBps + recipient
        SorobanRPC-->>Backend: Return data
        Backend->>Redis: Cache result (5 min)
    end
    Backend-->>Frontend: JSON {royaltyBps, recipient}
    Frontend->>User: Display royalty info
```

### 4. Batch Royalty (Public Endpoint)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Redis
    participant SorobanRPC
    participant SorobanContract

    User->>Frontend: Requests batch royalty data
    Frontend->>Backend: POST /nft/batch-royalty {tokenIds: [...]}
    Backend->>Redis: Check cache for each token
    Backend->>SorobanRPC: Call batch_royalty_info for uncached
    SorobanRPC->>SorobanContract: Read royalty states
    SorobanContract-->>SorobanRPC: Results
    SorobanRPC-->>Backend: Return data
    Backend->>Redis: Cache results (5 min)
    Backend-->>Frontend: Array of {tokenId, royaltyBps, recipient}
    Frontend->>User: Display in table/list
```

## API Endpoint Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/wallets/connect` | POST | JWT | Connect Stellar wallet |
| `/wallets/:id` | DELETE | JWT | Disconnect wallet |
| `/nfts/prepare-mint` | POST | JWT | Prepare mint transaction XDR |
| `/nfts/:mintAddress/royalty` | GET | Optional | Query single token royalty |
| `/nft/batch-royalty` | POST | None | Batch royalty query (max 100) |
| `/platform/revenue` | GET | Optional | Platform earnings from contract |

## Security Notes

- **Private keys never leave user device**: All signing occurs in wallet extension/frontend.
- **Backend validates**: Address format, ownership, duplicate minting.
- **Rate limiting**: Applied to prevent abuse (see `rate-limits.md`).
- **Environment variables**: 
  - `STELLAR_NETWORK`: `testnet` or `public`
  - `SOROBAN_NFT_CONTRACT_ID`: Deployed contract address
  - `PLATFORM_WALLET_ADDRESS`: Royalty recipient
  - `PINATA_JWT`: For IPFS metadata upload

## Related Documentation

- [`stellar-integration.md`](stellar-integration.md): Deep dive into backend services
- [`PAYOUT_ARCHITECTURE.md`](PAYOUT_ARCHITECTURE.md): XLM payout flows for off-clip earnings
- [`queue-architecture.md`](queue-architecture.md): Background job processing
- [`testing-strategy.md`](testing-strategy.md): How integration is tested

## Diagram Source

The sequence diagrams above use Mermaid syntax and can be rendered with:
- [Mermaid Live Editor](https://mermaid.live)
- VS Code + Mermaid plugin
- MkDocs with mermaid extension
