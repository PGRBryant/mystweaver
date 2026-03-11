# Quick Reference Card

## 🚀 Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start Docker services (Firestore + Redis)
docker-compose up -d

# Run API server (in terminal 1)
npm run dev --workspace=@labrats/api

# Run Web UI (in terminal 2)
npm run dev --workspace=@labrats/web
```

URLs:
- **Web UI**: http://localhost:5173
- **API**: http://localhost:3000
- **Firestore UI**: http://localhost:4000

---

## 📝 Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit (Conventional Commits format)
git add .
git commit -m "feat(api): add new endpoint"
# Commit types: feat, fix, docs, style, refactor, test, chore

# 3. Push and create PR
git push origin feature/my-feature

# 4. Merge after CI passes and review approved
```

---

## 🔍 Common Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install/update dependencies |
| `npm run dev` | Run dev in all workspaces |
| `npm run dev --workspace=@labrats/api` | Run API only |
| `npm run typecheck` | Type check all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run tests |
| `npm run build` | Build all packages |
| `npm run format` | Auto-format code |
| `npm run clean` | Remove build artifacts |

---

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset data (delete volumes)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache
```

---

## 🔐 GitHub Secrets (After GCP Setup)

Add these in: **Settings** → **Secrets and variables** → **Actions**

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT_EMAIL` | GitHub Actions service account email |
| `GCP_REGION` | GCP region (e.g., us-central1) |

---

## 📋 Checklist: Before Your First PR

- [ ] Code follows ESLint rules: `npm run lint`
- [ ] Types are correct: `npm run typecheck`
- [ ] Tests pass: `npm run test`
- [ ] Code is formatted: `npm run format`
- [ ] Commit message follows Conventional Commits
- [ ] PR description includes what and why

---

## 🆘 Quick Troubleshooting

**Docker won't start?**
```bash
docker-compose logs firestore
# Or reset: docker-compose down -v && docker-compose up -d
```

**TypeScript errors?**
```bash
npm run typecheck
# Make sure tsconfig.json extends config/tsconfig.base.json
```

**ESLint issues?**
```bash
npm run format  # Auto-fix
npm run lint    # Check remaining issues
```

**Port already in use?**
```bash
lsof -i :3000   # Find process
kill -9 <PID>   # Kill it
```

---

## 📚 Documentation

- **[README.md](README.md)** – Project overview
- **[CONTRIBUTING.md](CONTRIBUTING.md)** – Dev guidelines
- **[DOCKER.md](DOCKER.md)** – Docker setup
- **[GITHUB_SETUP.md](GITHUB_SETUP.md)** – GitHub repo init
- **[GCP_SETUP.md](GCP_SETUP.md)** – GCP + Workload Identity
- **[SETUP_COMPLETE.md](SETUP_COMPLETE.md)** – Full setup summary

---

## 🎯 Next Steps

1. Initialize GitHub repo: [GITHUB_SETUP.md](GITHUB_SETUP.md)
2. Set up GCP access: [GCP_SETUP.md](GCP_SETUP.md)
3. Run `docker-compose up -d` to start developing
4. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards

---

**Keep this file handy as you develop!**
