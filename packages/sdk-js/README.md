# @mystweaver/sdk-js

JavaScript/TypeScript SDK for [MystWeaver](https://github.com/PGRBryant/mystweaver) — a self-hosted feature flag and experimentation platform.

Works in Node.js and browsers. Zero external dependencies.

## Install

```bash
npm install @mystweaver/sdk-js
```

## Quick Start

```typescript
import { MystweaverClient } from '@mystweaver/sdk-js';

const client = new MystweaverClient({
  apiKey: 'mw_sdk_live_...',
  baseUrl: 'https://your-api.run.app',
});

const user = { id: 'player-42', attributes: { tier: 'premium', region: 'us' } };

// Boolean flag
const jetpackEnabled = await client.flag('powerups.jetpack-enabled', user);

// Typed value with fallback
const timer = await client.value('game.task-timer-seconds', user, 8);

// JSON flag
const tierWeights = await client.json('game.tier-weights', user, { common: 1 });

// Bulk evaluation (single request)
const flags = await client.evaluateAll([
  'powerups.jetpack-enabled',
  'game.task-timer-seconds',
  'game.sabotage-mode',
], user);

// Clean up
await client.close();
```

## Configuration

```typescript
const client = new MystweaverClient({
  apiKey: 'mw_sdk_live_...',       // Required — your SDK key
  baseUrl: 'https://...',          // Required — API URL
  defaults: {                      // Fallback values when API is unreachable
    'game.task-timer-seconds': 8,
    'powerups.jetpack-enabled': true,
  },
  streaming: true,                 // Enable SSE for real-time flag updates
  flushInterval: 5000,             // Event batch flush interval (ms)
  flushSize: 20,                   // Max events per batch before auto-flush
  timeout: 5000,                   // HTTP request timeout (ms)
});
```

## Event Tracking

Track metric events for experimentation and analytics. Events are batched and flushed automatically.

```typescript
client.track('room.completed', 'player-42', {
  roomType: 'leak',
  floor: 7,
  timeMs: 4200,
});

// Force-flush before shutdown
await client.flush();
```

## Real-Time Flag Updates (SSE)

Enable `streaming: true` to receive flag changes in real time via Server-Sent Events.

```typescript
const client = new MystweaverClient({
  apiKey: '...',
  baseUrl: '...',
  streaming: true,
});

// Listen for a specific flag
const unsub = client.onFlagChange('game.task-timer-seconds', (newValue, oldValue) => {
  console.log(`Timer changed: ${oldValue} → ${newValue}`);
});

// Listen for all SSE events
client.onEvent((event) => {
  console.log('SSE event:', event.type);
});

// Stop listening
unsub();
```

The SSE connection reconnects automatically with exponential backoff (1s → 2s → 4s → ... → 30s cap).

## Circuit Breaker

If the API becomes unreachable, the SDK automatically returns `defaults` values instead of throwing. After 3 consecutive failures the circuit opens and skips network calls entirely, returning defaults immediately. The circuit resets after 30 seconds.

```typescript
const client = new MystweaverClient({
  apiKey: '...',
  baseUrl: '...',
  defaults: {
    'powerups.jetpack-enabled': true,
    'game.task-timer-seconds': 8,
  },
});

// If API is down, this returns true (from defaults) instead of throwing
const enabled = await client.flag('powerups.jetpack-enabled', user);
```

## Testing with the Mock Client

Use `MystweaverMockClient` as a drop-in replacement in tests. No network calls, no API needed.

```typescript
import { MystweaverMockClient } from '@mystweaver/sdk-js/mock';

const client = new MystweaverMockClient({
  flags: {
    'game.task-timer-seconds': 8,
    'powerups.jetpack-enabled': true,
  },
});

// Same API as the real client
const timer = await client.value('game.task-timer-seconds', user, 8); // → 8

// Override flags at runtime
client.override('game.task-timer-seconds', 5);

// Simulate SSE flag changes
client.simulateFlagChange('powerups.jetpack-enabled', false);

// Inspect tracked events
client.track('room.completed', 'player-42', { floor: 7 });
console.log(client.trackedEvents); // [{ type: 'metric.tracked', event: 'room.completed', ... }]

// Reset between tests
client.reset({ 'game.task-timer-seconds': 8 });
```

## API Reference

### `MystweaverClient`

| Method | Returns | Description |
|--------|---------|-------------|
| `flag(key, context)` | `Promise<boolean>` | Evaluate a boolean flag |
| `value(key, context, default)` | `Promise<T>` | Evaluate a flag with typed fallback |
| `json(key, context, default)` | `Promise<T>` | Evaluate a JSON flag |
| `evaluateAll(keys, context)` | `Promise<Record<string, unknown>>` | Bulk evaluate multiple flags |
| `track(event, userId, properties?)` | `void` | Track a metric event (batched) |
| `onFlagChange(key, listener)` | `() => void` | Subscribe to flag changes (returns unsub) |
| `onEvent(listener)` | `() => void` | Subscribe to all SSE events (returns unsub) |
| `flush()` | `Promise<void>` | Flush pending events |
| `close()` | `Promise<void>` | Flush events, close SSE, release resources |

### `MystweaverMockClient`

Same evaluation/tracking API as `MystweaverClient`, plus:

| Method | Description |
|--------|-------------|
| `override(key, value)` | Set a flag value at runtime |
| `simulateFlagChange(key, value)` | Fire `onFlagChange` listeners |
| `reset(flags?)` | Reset flags and clear tracked events |
| `trackedEvents` | Array of all `track()` calls |

## Exports

```typescript
// Main client
import { MystweaverClient, HttpError } from '@mystweaver/sdk-js';

// Mock client (for testing)
import { MystweaverMockClient } from '@mystweaver/sdk-js/mock';

// Types
import type {
  MystweaverConfig,
  UserContext,
  EvaluationResult,
  BulkEvaluationResult,
  FlagChangeListener,
  SSEEvent,
} from '@mystweaver/sdk-js';
```

## Build Formats

- ESM: `dist/index.mjs`
- CJS: `dist/index.js`
- TypeScript declarations: `dist/index.d.ts`

Tree-shakeable. No external dependencies.
