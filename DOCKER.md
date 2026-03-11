# Docker Compose Local Development Guide

## Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up volumes (reset data)
docker-compose down -v
```

## Services

### Firestore Emulator
- **Port**: 8080 (API), 4000 (UI)
- **URL**: http://localhost:4000
- **Connection**: `FIRESTORE_EMULATOR_HOST=localhost:8080`
- **Project ID**: `labrats-local`

### Redis
- **Port**: 6379
- **Host**: `localhost` (from host), `redis` (from Docker)
- **CLI**: `docker-compose exec redis redis-cli`

### API Server
- **Port**: 3000
- **URL**: http://localhost:3000
- **Environment**: See `docker-compose.yml`

## Development Workflow

### Option 1: Run API from Host (Recommended for Development)

```bash
# Start supporting services only
docker-compose up -d firestore redis

# In your terminal, run
npm run dev --workspace=@labrats/api

# Set environment variables
export FIRESTORE_EMULATOR_HOST=localhost:8080
export REDIS_HOST=localhost
```

### Option 2: Run Everything in Docker

```bash
docker-compose up

# API logs
docker-compose logs -f api
```

## Testing Database Connections

### Firestore

```bash
# Access Firestore UI
open http://localhost:4000

# Or programmatically:
# With FIRESTORE_EMULATOR_HOST set, any Firestore client will connect to emulator
```

### Redis

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Test commands
PING
SET key value
GET key
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :6379
lsof -i :8080

# Kill process (macOS/Linux)
kill -9 <PID>
```

### Services Won't Start

```bash
# Check logs
docker-compose logs firestore
docker-compose logs redis

# Rebuild images
docker-compose build --no-cache
```

### Data Persistence

- **Firestore**: Data stored in `firestore-data` volume
- **Redis**: Data stored in `redis-data` volume

To reset:
```bash
docker-compose down -v
docker-compose up -d
```

## Environment Variables

See the `environment` section in `docker-compose.yml` for all available options:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator | `localhost:8080` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `API_KEY_HEADER` | Header for API key | `X-API-Key` |
