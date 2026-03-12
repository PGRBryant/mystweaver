# Quick Reference Card

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start Docker services (Firestore emulator + Redis)
docker-compose up -d

# Run API server (terminal 1)
npm run dev --workspace=@mystweaver/api

# Run Web UI (terminal 2)
npm run dev --workspace=@mystweaver/web
```

Local URLs:

- **Web UI**: http://localhost:5173
- **API**: http://localhost:3000
- **Firestore emulator**: localhost:8080 (no UI — bare gRPC/REST endpoint)
- **Redis**: localhost:6379

---

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Commit (Conventional Commits format)
git add apps/api/src/my-file.ts
git commit -m "feat(api): add new endpoint"
# Types: feat, fix, docs, style, refactor, test, chore

# 3. Push and open PR
git push origin feature/my-feature
```

---

## Common Commands

| Command                                   | Purpose                     |
| ----------------------------------------- | --------------------------- |
| `npm install`                             | Install/update dependencies |
| `npm run dev --workspace=@mystweaver/api` | Run API only                |
| `npm run typecheck`                       | Type check all packages     |
| `npm run lint`                            | Lint all packages           |
| `npm run test`                            | Run tests                   |
| `npm run build`                           | Build all packages          |
| `npm run format`                          | Auto-format code            |
| `npm run clean`                           | Remove build artifacts      |

---

## Docker Commands

```bash
docker-compose up -d                  # start services in background
docker-compose logs -f                # tail all logs
docker-compose logs -f firestore      # tail one service
docker-compose down                   # stop services
docker-compose down -v                # stop + wipe volumes
```

---

## GCP Setup (one-time)

```bash
# 1. Bootstrap (creates state bucket, enables APIs)
export PROJECT_ID="your-project-id" GITHUB_ORG="yourusername"
bash infra/bootstrap.sh

# 2. Apply infrastructure
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
# edit terraform.tfvars
cd infra/terraform && terraform init && terraform apply

# 3. Add GitHub secrets (values from `terraform output`)
gh secret set GCP_PROJECT_ID        --body "$PROJECT_ID"
gh secret set GCP_REGION            --body "us-central1"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$(terraform output -raw workload_identity_provider)"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL      --body "$(terraform output -raw github_actions_service_account)"
```

Full guide: [GCP_SETUP.md](GCP_SETUP.md)

---

## Checklist: Before Your First PR

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run format` applied
- [ ] Commit message follows Conventional Commits
- [ ] PR description explains what and why

---

## Quick Troubleshooting

**Docker won't start?**

```bash
docker-compose logs firestore
docker-compose down -v && docker-compose up -d
```

**TypeScript errors?**

```bash
npm run typecheck
```

**Port already in use?**

```bash
lsof -i :3000   # find process
kill -9 <PID>
```

---

## Documentation

| Doc                                | Purpose               |
| ---------------------------------- | --------------------- |
| [README.md](README.md)             | Project overview      |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev guidelines        |
| [DOCKER.md](DOCKER.md)             | Local dev environment |
| [GITHUB_SETUP.md](GITHUB_SETUP.md) | GitHub repo init      |
| [GCP_SETUP.md](GCP_SETUP.md)       | GCP + Terraform + WIF |
