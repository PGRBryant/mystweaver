# Mystweaver

<div align="center">

**An open-source, self-hosted feature flag and experimentation platform**

A production-ready alternative to LaunchDarkly, built for teams that want full control over their feature flag infrastructure.

[Roadmap](ROADMAP.md) · [Quick Start](#quick-start) · [Contributing](#contributing) · [License](LICENSE)

[![CI](https://github.com/PGRBRyant/mystweaver/actions/workflows/ci.yml/badge.svg)](https://github.com/PGRBRyant/mystweaver/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

</div>

## Development Status

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Foundation — SDK key management, flag CRUD, evaluation, SSE, events | **Not started** |
| **Phase 2** | Admin Interface — auth, flag management UI, audit log | Not started |
| **Phase 3** | Experimentation — A/B testing, statistical results engine | Not started |
| **Phase 4** | SDK Package — `@mystweaver/sdk` for JS/TS (browser + Node) | Not started |
| **Phase 5** | Production Readiness — Terraform, CI/CD, observability, security | Partial (scaffold exists) |

See [ROADMAP.md](ROADMAP.md) for the full engineering roadmap with milestones, dependency graph, and definition of done for each item.

## Overview

Mystweaver is a self-hosted feature flag and experimentation platform designed for development teams who need:

- **Full control** over flag data and infrastructure
- **Real-time flag updates** via Server-Sent Events
- **A/B experimentation** with statistical significance testing
- **Multiple SDKs** for JavaScript/TypeScript (browser + Node.js)
- **Easy deployment** to GCP Cloud Run
- **Google IAP integration** for secure admin UI access
- **Comprehensive observability** with Cloud Logging and Monitoring

### Why Mystweaver?

- **Open Source** — No vendor lock-in, community-driven development
- **Scalable** — Redis caching, real-time SSE streaming, Cloud Trace integration
- **Secure** — Google IAP for admin access, hashed SDK keys, rate limiting
- **Developer-Friendly** — Local development with Docker Compose, mock SDK client for testing
- **Cost-Effective** — Pay only for the infrastructure you use on GCP

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Modern, fast, type-safe |
| **Backend** | Node.js + Express + TypeScript | Lightweight and performant |
| **Database** | Firestore | Serverless, auto-scaling |
| **Cache** | Cloud Memorystore (Redis) | Sub-millisecond flag lookups |
| **Streaming** | Server-Sent Events (SSE) | Real-time flag updates to clients |
| **Observability** | Logging, Monitoring, Cloud Trace | Built-in GCP integration |
| **Hosting** | Cloud Run | Serverless, pay-as-you-go |
| **IaC** | Terraform | Reproducible infrastructure |
| **CI/CD** | GitHub Actions + Workload Identity | Secure, keyless deployment |

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **Docker** and **Docker Compose** (for local development)
- **GCP Project** (for deployment only)

### Local Development

```bash
# Clone the repository
git clone https://github.com/PGRBRyant/mystweaver.git
cd mystweaver

# Install dependencies
npm install

# Start Firestore emulator + Redis
docker-compose up -d

# Seed the Room 404 flag set and create a test SDK key
npm run seed

# Start the API server (with Firestore emulator)
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev --workspace=@mystweaver/api

# In another terminal, start the Web UI
npm run dev --workspace=@mystweaver/web
```

> **Windows (PowerShell):** Replace the `FIRESTORE_EMULATOR_HOST=...` line with:
> ```powershell
> $env:FIRESTORE_EMULATOR_HOST="localhost:8080"; npm run dev --workspace=@mystweaver/api
> ```

The admin UI will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

### SDK Usage

```typescript
import { MystWeaverClient } from '@mystweaver/sdk';

const client = new MystWeaverClient({
  apiKey: 'mw_sdk_live_...',
  baseUrl: 'http://localhost:3000',
  streaming: true,
});

// Evaluate a single flag
const timerSeconds = await client.value('game.task-timer-seconds', userContext, 8);

// Evaluate all flags at once
const flags = await client.evaluateAll([
  'game.task-timer-seconds',
  'powerups.jetpack-enabled',
], userContext);

// Track events for experimentation
client.track('room.completed', userId, { roomType: 'leak', floor: 7 });

// Listen for real-time flag changes
client.onFlagChange('game.task-timer-seconds', (newValue) => {
  updateGameTimer(newValue);
});

// Cleanup
await client.flush();
await client.close();
```

### Testing with the Mock Client

```typescript
import { MystWeaverMockClient } from '@mystweaver/sdk/mock';

const client = new MystWeaverMockClient({
  flags: {
    'game.task-timer-seconds': 8,
    'powerups.jetpack-enabled': true,
  },
});

// Override at runtime
client.override('game.task-timer-seconds', 5);

// Assert tracked events
expect(client.trackedEvents).toContainEqual({
  event: 'room.completed',
  userId: 'plr_123',
});
```

## Room 404 Integration

[Room 404](https://github.com/PGRBRyant/room-404) is a multiplayer browser game that consumes MystWeaver as its feature flag and experimentation backend. This integration drives the roadmap priorities.

### Integration Milestones

| Milestone | Room 404 Capability | MystWeaver Requirement |
|-----------|---------------------|----------------------|
| **Room 404 can start building** | SDK calls against local MystWeaver | Phase 1 complete |
| **Room 404 can run integration tests** | Automated tests with mock + real SDK | Phase 1 + Phase 4 complete |
| **Live demo ready** | Full demo with admin UI + experiments | All phases complete |

### Flag Contract

MystWeaver seeds 24 flags for Room 404 covering rooms, powerups, game mechanics, AI behavior, and tier weights. Run `npm run seed` to populate them in your local emulator. See [ROADMAP.md](ROADMAP.md#room-404-integration-contract) for the full flag list.

### CORS

MystWeaver is configured to accept requests from:

- `https://room404.dev`
- `https://*.room404.dev`
- `http://localhost:5174` (Room 404 local dev)

## Project Structure

```
mystweaver/
├── apps/
│   ├── api/                 # Express backend server
│   │   └── src/
│   └── web/                 # React admin UI
│       └── src/
├── packages/
│   └── sdk-js/              # @mystweaver/sdk (JS/TS)
│       └── src/
├── scripts/
│   └── seed-flags.ts        # Seed Room 404 flags into emulator
├── infra/
│   └── terraform/           # GCP infrastructure as code
├── .github/
│   └── workflows/           # CI + deploy pipelines
├── docker-compose.yml       # Local dev (Firestore emulator + Redis)
├── Dockerfile               # Production image
├── ROADMAP.md               # Full engineering roadmap
└── package.json             # Monorepo root
```

## Development

### Commands

```bash
npm install                  # Install all dependencies
npm run dev                  # Run all workspaces in dev mode
npm run build                # Build all packages
npm run test                 # Run all tests
npm run lint                 # Lint all packages
npm run typecheck            # Type check all packages
npm run seed                 # Seed Room 404 flags into Firestore emulator
npm run format               # Format code with Prettier
npm run clean                # Clean build artifacts
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of Conduct
- Development Setup
- Commit Message Guidelines
- PR Process

## Support

- **Issues**: [GitHub Issues](https://github.com/PGRBRyant/mystweaver/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PGRBRyant/mystweaver/discussions)

## License

Mystweaver is licensed under the [Apache License 2.0](LICENSE).
