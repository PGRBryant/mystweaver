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
| **Phase 1** | Foundation — SDK key management, flag CRUD, evaluation engine, SSE streaming, event ingestion | **Complete** |
| **Phase 2** | Admin Interface — authentication, flag management UI, audit log | **Complete** |
| **Phase 3** | Experimentation — A/B testing, statistical results engine, live results UI | **Complete** |
| **Phase 4** | SDK Package — `@mystweaver/sdk-js` for JS/TS (browser + Node) | **Complete** |
| **Phase 5** | Production Readiness — Terraform, CI/CD, observability, security hardening | Partial (infra exists) |

See [ROADMAP.md](ROADMAP.md) for the full engineering roadmap with milestones, dependency graph, and definition of done for each item.

## What's Working

### Backend API

**Admin routes** (authenticated via Google IAP in production, dev bypass locally):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags` | Create a flag |
| `GET` | `/api/flags` | List all flags |
| `GET` | `/api/flags/:key` | Get a single flag |
| `PUT` | `/api/flags/:key` | Full update |
| `PATCH` | `/api/flags/:key` | Partial update (toggle, rename, etc.) |
| `DELETE` | `/api/flags/:key` | Soft delete |
| `POST` | `/api/sdk-keys` | Create an SDK key |
| `GET` | `/api/sdk-keys` | List SDK keys (metadata only) |
| `DELETE` | `/api/sdk-keys/:id` | Revoke an SDK key |
| `GET` | `/api/audit` | Query audit log (filter by flag, action, user) |
| `GET` | `/api/audit/export` | Export audit log as CSV |
| `POST` | `/api/experiments` | Create an experiment |
| `GET` | `/api/experiments` | List experiments |
| `GET` | `/api/experiments/:id` | Get experiment detail |
| `PATCH` | `/api/experiments/:id` | Update a draft experiment |
| `DELETE` | `/api/experiments/:id` | Delete a draft experiment |
| `POST` | `/api/experiments/:id/start` | Start experiment (modifies flag rules) |
| `POST` | `/api/experiments/:id/stop` | Stop experiment (reverts flag) |
| `POST` | `/api/experiments/:id/conclude` | Declare winner (promotes variant value) |
| `GET` | `/api/experiments/:id/results` | Compute statistical results |
| `GET` | `/api/auth/me` | Get current user email |

**SDK routes** (authenticated via `Authorization: Bearer <sdk-key>`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sdk/evaluate` | Evaluate a single flag |
| `POST` | `/sdk/evaluate/bulk` | Evaluate up to 50 flags |
| `GET` | `/sdk/stream` | SSE stream of real-time flag updates |
| `POST` | `/sdk/events` | Ingest evaluation and metric events |

### Admin UI

- **Flag list** — Search by key/name, filter by status/type/tag, inline enable/disable toggle
- **Flag editor** — Edit name, description, default value, tags, targeting rules with rollout percentages
- **Evaluation preview** — Input a user context and see the evaluation result live
- **Audit log** — Filterable history of every flag mutation with before/after diffs, CSV export
- **Experiments** — Create, start, stop, conclude experiments with live results dashboard
- **Results dashboard** — Sample size bars, metric comparison table, p-value with plain English explanation, "declare winner" flow

### Evaluation Engine

- Rules evaluated top-to-bottom, first match wins
- Conditions AND'd within a rule (operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `contains`)
- Deterministic percentage rollouts via SHA-256 hash
- Redis read-through cache with Pub/Sub invalidation

### Experimentation

- Start an experiment to split traffic by variant weights (modifies flag targeting rules)
- Stop to revert to pre-experiment state
- Conclude to promote winning variant's value as the flag default
- Welch's t-test for statistical significance (p < 0.05)
- Results computed on demand from ingested evaluation + metric events

### SDK (`@mystweaver/sdk-js`)

```typescript
import { MystweaverClient } from '@mystweaver/sdk-js';

const client = new MystweaverClient({
  apiKey: 'mw_sdk_live_...',
  baseUrl: 'https://api.mystweaver.dev',
  defaults: { 'game.task-timer-seconds': 8 },  // fallbacks when API is down
  streaming: true,                               // enable real-time SSE updates
  flushInterval: 5000,                           // event batch flush interval (ms)
});

// Evaluate flags
const enabled = await client.flag('powerups.jetpack-enabled', { id: 'user-123' });
const timer = await client.value('game.task-timer-seconds', { id: 'user-123' }, 8);
const weights = await client.json('game.tier-weights', { id: 'user-123' }, {});
const all = await client.evaluateAll(['flag-a', 'flag-b'], { id: 'user-123' });

// Track events for experimentation
client.track('room.completed', 'user-123', { floor: 7, roomType: 'leak' });

// Real-time flag changes
client.onFlagChange('game.task-timer-seconds', (newVal, prev) => { /* ... */ });

// Cleanup
await client.flush();
await client.close();
```

**Features:** zero dependencies, browser + Node.js, circuit breaker with automatic defaults fallback, SSE auto-reconnect with exponential backoff, event batching, tree-shakeable ESM + CJS builds.

**Testing:** Use the mock client as a drop-in replacement:

```typescript
import { MystweaverMockClient } from '@mystweaver/sdk-js/mock';

const client = new MystweaverMockClient({
  flags: { 'game.task-timer-seconds': 8, 'powerups.jetpack-enabled': true },
});
client.override('game.task-timer-seconds', 5);
client.simulateFlagChange('powerups.jetpack-enabled', false);
expect(client.trackedEvents).toHaveLength(0);
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **SDK** | `@mystweaver/sdk-js` — zero-dependency JS/TS client (ESM + CJS) |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | Google Cloud Firestore |
| **Cache** | Cloud Memorystore (Redis 7) |
| **Streaming** | Server-Sent Events (SSE) |
| **Auth** | Google IAP (production), dev bypass (local) |
| **Eventing** | Cloud Pub/Sub |
| **Hosting** | Cloud Run |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions + Workload Identity Federation |

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **Docker Desktop** (for Firestore emulator + Redis)

### Local Development

**Terminal 1 — Start infrastructure (Firestore emulator + Redis):**

```bash
docker compose up -d
```

**Terminal 2 — API server:**

```bash
# macOS / Linux
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev -w apps/api

# Windows (PowerShell)
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"; npm run dev -w apps/api
```

**Terminal 3 — Web UI:**

```bash
npm run dev -w apps/web
```

**Seed test data (run once, in a new terminal):**

```bash
# macOS / Linux
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run seed

# Windows (PowerShell)
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"; npm run seed
```

The admin UI will be at `http://localhost:5173` and the API at `http://localhost:3000`.

The seed script populates 24 Room 404 flags, 2 experiment definitions, and a test SDK key (printed once — save it).

**Test the SDK against the local API:**

```bash
npx tsx scripts/test-sdk.ts <your-sdk-key>
```

## Room 404 Integration

[Room 404](https://github.com/PGRBRyant/room-404) is a multiplayer browser game that uses Mystweaver as its feature flag and experimentation backend. This integration drives roadmap priorities.

| Milestone | Room 404 Capability | Requirement |
|-----------|---------------------|-------------|
| **Can start building** | SDK calls against local Mystweaver | Phase 1 (done) |
| **Can run integration tests** | Automated tests with mock + real SDK | Phase 4 (done) |
| **Live demo ready** | Full demo with admin UI + experiments | All phases |

The seed script populates all 24 Room 404 flags covering rooms, powerups, game mechanics, AI behavior, and item tier weights. See [ROADMAP.md](ROADMAP.md#room-404-integration-contract) for the full flag contract.

## Project Structure

```
mystweaver/
├── apps/
│   ├── api/                 # Express API server
│   │   └── src/
│   │       ├── db/          # Firestore, Redis, Pub/Sub clients
│   │       ├── middleware/  # Auth, validation, error handling
│   │       ├── routes/      # REST endpoints
│   │       ├── services/    # Business logic
│   │       ├── types/       # TypeScript types
│   │       └── __tests__/   # Unit tests
│   └── web/                 # React admin UI
│       └── src/
│           ├── api/         # API client
│           ├── components/  # Reusable UI components
│           ├── hooks/       # React hooks
│           ├── pages/       # Route pages
│           └── types/       # Frontend types
├── packages/
│   └── sdk-js/              # @mystweaver/sdk-js (JS/TS SDK)
│       └── src/
│           ├── client.ts    # MystweaverClient (evaluation, events, SSE)
│           ├── mock.ts      # MystweaverMockClient (test double)
│           ├── http.ts      # Fetch wrapper with timeout
│           ├── circuit-breaker.ts  # Resilience (closed/open/half-open)
│           ├── event-queue.ts      # Event batching + flush
│           ├── sse.ts       # SSE manager with auto-reconnect
│           └── types.ts     # SDK type definitions
├── scripts/
│   ├── seed-flags.ts        # Seed Room 404 flags + experiments
│   └── test-sdk.ts          # SDK integration smoke test
├── infra/
│   ├── terraform/           # GCP infrastructure as code
│   └── bootstrap.sh         # One-time GCP bootstrap script
├── .github/
│   └── workflows/           # CI + deploy pipelines
├── docker-compose.yml       # Local dev services
├── Dockerfile               # Production image
├── ROADMAP.md               # Full engineering roadmap
└── package.json             # Monorepo root
```

## Commands

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

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit guidelines, and PR process.

## License

Mystweaver is licensed under the [Apache License 2.0](LICENSE).
