# Contributing to ClipCash Backend

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Contributor Roles](#contributor-roles)
- [Development Workflow](#development-workflow)
- [Stellar Bounty Program](#stellar-bounty-program)
- [Soroban Contract Contributions](#soroban-contract-contributions)
- [Code Standards](#code-standards)
- [Submitting a Pull Request](#submitting-a-pull-request)

---

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in required values
4. Run database migrations: `npx prisma migrate dev`
5. Start the dev server: `npm run start:dev`

---

## Contributor Roles

We welcome contributors with different skills and interests! Find the role that matches your expertise:

### 🌐 Web3 / Blockchain Developer

Work on Stellar network integration, Soroban smart contracts, and NFT functionality.

**Key areas:**
- `src/stellar/` — Stellar SDK configuration and network integration
- `src/wallets/` — Wallet connection and management
- `src/nft/` — NFT minting and royalty logic
- `src/payouts/` — Stellar payout processing
- `contracts/nft-royalty/` — Soroban smart contracts (Rust)

**Prerequisites:**
- Familiarity with Stellar SDK and Soroban
- Understanding of blockchain transactions and wallet connections
- Rust knowledge for contract development

**Good first issues:** Look for `web3`, `stellar`, or `soroban` labels

---

### 🎬 Video Processing Developer

Enhance video upload, clip generation, and FFmpeg processing pipelines.

**Key areas:**
- `src/videos/` — Video upload and validation
- `src/clips/` — Clip generation, FFmpeg utilities, virality scoring
- `src/clips/ffmpeg.util.ts` — FFmpeg video cutting logic
- `src/clips/cloudinary.service.ts` — Cloudinary upload handling
- `src/jobs/` — BullMQ job queues for background processing

**Prerequisites:**
- Experience with FFmpeg or video processing libraries
- Understanding of asynchronous job queues (BullMQ)
- Knowledge of cloud storage (Cloudinary)

**Good first issues:** Look for `video`, `ffmpeg`, or `clips` labels

---

### 🎨 Frontend / API Integration Developer

Build and improve API endpoints, Swagger documentation, and client-facing features.

**Key areas:**
- `src/**/dto/` — Request/response DTOs
- `src/**/controllers.ts` — REST API endpoints
- `src/main.ts` — Swagger/OpenAPI configuration
- `test/*.e2e-spec.ts` — End-to-end API tests

**Prerequisites:**
- NestJS or similar framework experience
- REST API design principles
- OpenAPI/Swagger documentation

**Good first issues:** Look for `api`, `documentation`, or `frontend` labels

---

### 🔒 Security / DevOps Developer

Improve authentication, rate limiting, security headers, and deployment infrastructure.

**Key areas:**
- `src/auth/` — JWT, OAuth, magic links, MFA
- `src/middlewares/` — Rate limiting, CSRF protection
- `src/encryption/` — Sensitive data encryption
- `docker-compose.yml` — Docker setup
- `.github/workflows/` — CI/CD pipelines

**Prerequisites:**
- Security best practices (OWASP)
- Docker and containerization
- CI/CD workflows (GitHub Actions)

**Good first issues:** Look for `security`, `devops`, or `infrastructure` labels

---

### 🧪 Testing / QA Developer

Write comprehensive tests, improve code coverage, and ensure quality across the codebase.

**Key areas:**
- `test/` — E2E and integration tests
- `src/**/*.spec.ts` — Unit tests
- Test fixtures and mocks

**Prerequisites:**
- Jest or similar testing framework
- Understanding of unit, integration, and E2E testing
- Test-driven development (TDD) principles

**Good first issues:** Look for `testing`, `qa`, or `good-first-issue` labels

---

### 📚 Documentation Writer

Improve developer documentation, API guides, architecture diagrams, and onboarding materials.

**Key areas:**
- `README.md` — Project overview and setup
- `CONTRIBUTING.md` — Contribution guidelines
- `docs/` — Architecture and integration docs
- Swagger/OpenAPI endpoint documentation

**Prerequisites:**
- Clear technical writing skills
- Markdown proficiency
- Understanding of developer documentation best practices

**Good first issues:** Look for `documentation` or `good-first-issue` labels

---

### 🔌 Platform Integrations Developer

Add support for new social media platforms, webhooks, and third-party service integrations.

**Key areas:**
- `src/user-platform/` — Platform account connections
- `src/clips/ayrshare.service.ts` — Social media posting
- `src/webhooks/` — Webhook handling for external platforms
- `src/earnings/` — Multi-platform earnings aggregation

**Prerequisites:**
- REST API integration experience
- OAuth flows and webhook handling
- Understanding of social media APIs (TikTok, Instagram, YouTube)

**Good first issues:** Look for `integration`, `platform`, or `webhooks` labels

---

### 🗄️ Database / Performance Developer

Optimize Prisma queries, improve database schema, and enhance application performance.

**Key areas:**
- `prisma/schema.prisma` — Database schema
- Service files with Prisma queries
- Indexing and query optimization
- Database migrations

**Prerequisites:**
- PostgreSQL and Prisma experience
- Query optimization and indexing
- Database design principles

**Good first issues:** Look for `prisma`, `database`, or `performance` labels

---

**Not sure where to start?** Check out issues labeled `good-first-issue` or join our community discussions!

---

## Development Workflow

- Create a branch from `main` using the format: `type/issue-number-short-description`
  - Examples: `feat/301-clip-search`, `fix/288-payout-race`, `docs/295-swagger-tags`
- Keep commits focused and use [Conventional Commits](https://www.conventionalcommits.org/) format
- Do not push directly to `main`
- All PRs require passing CI checks before merge

---

## Stellar Bounty Program

ClipCash participates in the **Stellar Community Fund** open-source bounty program. Eligible contributors can earn XLM rewards for completing tagged issues.

### Eligible Issues

Issues tagged with `stellar-bounty` on the [issue tracker](https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty) are eligible for rewards.

### How to Claim a Bounty

1. **Find an open bounty issue** — look for the `stellar-bounty` label
2. **Comment on the issue** to express intent and avoid duplicate work
3. **Submit a PR** that fully satisfies the acceptance criteria
4. **Include your Stellar wallet address** in the PR description using this format:
   ```
   Stellar Wallet: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
5. Once the PR is merged and reviewed, the bounty is paid out in XLM to the provided address

### Bounty Board

See open bounties: [https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty+is%3Aopen](https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty+is%3Aopen)

### Rules

- One bounty per contributor per issue
- Partial implementations are not eligible — all acceptance criteria must be met
- The maintainer team has final say on bounty eligibility
- Bounties are paid within 7 days of PR merge

---

## Soroban Contract Contributions

ClipCash uses [Soroban](https://soroban.stellar.org/) smart contracts for NFT royalties and on-chain payments. Contract code lives in `contracts/nft-royalty/`.

### Setup

```bash
# Install Rust and the Soroban CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --locked soroban-cli

# Build contracts
cd contracts/nft-royalty
cargo build --target wasm32-unknown-unknown --release
```

### Guidelines

- All contract changes must include unit tests in the same PR
- Run `cargo test` before submitting
- Do not change the public interface of existing contract functions without a migration plan
- Document any new contract events in `contracts/nft-royalty/BATCH_ROYALTY_QUERY.md`
- Test on Stellar Testnet before targeting mainnet deployment

---

## Code Standards

- **TypeScript**: strict mode, no `any` unless unavoidable
- **Formatting**: Prettier (`npm run format`)
- **Linting**: ESLint (`npm run lint`)
- **Tests**: Vitest for unit tests; add tests for any new service logic
- **Swagger**: all new controller endpoints must have `@ApiOperation` and `@ApiResponse` decorators

---

## Submitting a Pull Request

1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Reference the issue in your PR title or description: `Closes #<issue-number>`
4. Fill out the PR template completely
5. Request a review from a maintainer

For questions, open a [Discussion](https://github.com/ANYTECHS/clips-backend/discussions) or join the community.
