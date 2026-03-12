# Mystweaver

<div align="center">

**An open-source, self-hosted feature flag service**

A production-ready alternative to LaunchDarkly, built for teams that want full control over their feature flag infrastructure.

[Documentation](#documentation) · [Quick Start](#quick-start) · [Contributing](#contributing) · [License](LICENSE)

[![CI](https://github.com/PGRBRyant/mystweaver/actions/workflows/ci.yml/badge.svg)](https://github.com/PGRBRyant/mystweaver/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

</div>

## Overview

Mystweaver is a self-hosted feature flag service designed for development teams who need:

- **Full control** over flag data and infrastructure
- **Production-grade reliability** with caching, Pub/Sub, and distributed tracing
- **Multiple SDKs** for JavaScript/TypeScript, Python, and more
- **Easy deployment** to GCP Cloud Run, AWS, or any Kubernetes cluster
- **Google IAP integration** for secure admin UI access
- **Comprehensive observability** with Cloud Logging and Monitoring

### Why Mystweaver?

- **Open Source** – No vendor lock-in, community-driven development
- **Scalable** – Redis caching, Pub/Sub for real-time flag updates, Cloud Trace integration
- **Secure** – Google IAP for admin access, API key authentication for SDKs
- **Developer-Friendly** – Local development with Docker Compose, simple API design
- **Cost-Effective** – Pay only for the infrastructure you use on GCP

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Modern, fast, type-safe |
| **Backend** | Node.js + Express + TypeScript | Lightweight and performant |
| **Database** | Firestore | Serverless, auto-scaling |
| **Cache** | Cloud Memorystore (Redis) | Sub-millisecond flag lookups |
| **Eventing** | Cloud Pub/Sub | Real-time flag change fanout |
| **Observability** | Logging, Monitoring, Cloud Trace | Built-in GCP integration |
| **Hosting** | Cloud Run | Serverless, pay-as-you-go |
| **IaC** | Terraform | Reproducible infrastructure |
| **CI/CD** | GitHub Actions + Workload Identity | Secure, keyless deployment |

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Docker** and **Docker Compose** (for local development)
- **GCP Project** (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/PGRBRyant/mystweaver.git
cd mystweaver

# Install dependencies
npm install

# Start the development environment (API + Redis + Firestore emulator)
docker-compose up -d

# Run the API server
npm run dev --workspace=@mystweaver/api

# In another terminal, run the Web UI
npm run dev --workspace=@mystweaver/web
```

The admin UI will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

### Basic Usage

```javascript
import { createClient } from '@mystweaver/sdk-js';

const client = createClient({
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key',
});

// Check if a flag is enabled for a user
const isEnabled = await client.isFeatureEnabled('new-dashboard', {
  userId: 'user-123',
  email: 'user@example.com',
});

if (isEnabled) {
  // Show new feature
}
```

## Project Structure

```
mystweaver/
├── apps/
│   ├── api/                 # Express backend server
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                 # React admin UI
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── sdk-js/              # JavaScript/TypeScript SDK
│   │   ├── src/
│   │   └── package.json
│   └── sdk-python/          # Python SDK
│       ├── src/
│       └── pyproject.toml
├── infra/
│   └── terraform/           # GCP infrastructure as code
├── config/
│   └── tsconfig.base.json   # Shared TypeScript config
├── .github/
│   ├── workflows/
│   │   └── ci.yml           # CI/CD pipeline
│   └── ISSUE_TEMPLATE/      # Issue templates
├── docker-compose.yml       # Local development setup
├── Dockerfile               # Production image
└── package.json             # Monorepo configuration
```

## Documentation

Full documentation coming soon, including:
- API Reference
- SDK Documentation
- Deployment Guides
- Architecture Overview
- Contribution Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## Features (Roadmap)

- [x] Project structure and tooling
- [x] Core flag evaluation engine
- [x] Terraform infrastructure modules
- [x] GitHub Actions CI/CD setup
- [ ] Admin UI (flag creation, management, targeting)
- [ ] JavaScript/TypeScript SDK
- [ ] Python SDK
- [ ] Real-time flag updates via Pub/Sub
- [ ] Audit logging
- [ ] Flag versioning and rollback
- [ ] Advanced targeting (user segments, custom attributes)
- [ ] A/B testing capabilities
- [ ] Usage analytics
- [ ] Integration tests and E2E tests

## Development

### Commands

```bash
# Install all dependencies
npm install

# Run linting across all packages
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# Build all packages
npm run build

# Format code
npm run format

# Clean build artifacts
npm run clean
```

### Adding a New Package

```bash
# Create the package structure
mkdir -p packages/my-package/src

# Create package.json in packages/my-package/
# Add scripts: dev, build, test, lint, typecheck
# Use the existing packages as templates

# Install and verify
npm install
npm run build --workspace=@mystweaver/my-package
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
- **Documentation**: [Docs](https://mystweaver.dev) *(coming soon)*

## License

Mystweaver is licensed under the [Apache License 2.0](LICENSE).

## Acknowledgments

Inspired by community feedback and the need for a transparent, self-hosted feature flag solution. Built with ❤️ for the open-source community.

---

**Ready to get started?** Check out the [Quick Start](#quick-start) section or read [CONTRIBUTING.md](CONTRIBUTING.md) to set up your development environment.
