# Initializing the GitHub Repository

This guide walks you through setting up the Mystweaver GitHub repository from scratch and connecting it to your GCP project.

## Table of Contents

1. [Initial Git Setup](#initial-git-setup)
2. [Creating the Remote Repository](#creating-the-remote-repository)
3. [Pushing to GitHub](#pushing-to-github)
4. [GitHub Configuration](#github-configuration)
5. [Next Steps](#next-steps)

---

## Initial Git Setup

### Step 1: Initialize Git Repository Locally

```bash
cd ~/Code/mystweaver

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "feat: initialize monorepo scaffold with project structure

- Set up npm workspaces for apps and packages
- Configure TypeScript, ESLint, and Prettier
- Create Dockerfile and docker-compose for local development
- Add GitHub Actions CI workflow
- Create issue and PR templates
- Add comprehensive README, CONTRIBUTING, and deployment guides"
```

### Step 2: Configure Git User (If Needed)

```bash
# Set local user (or use --global for system-wide)
git config user.email "your-email@example.com"
git config user.name "Your Name"

# Verify
git config --list
```

---

## Creating the Remote Repository

### Option A: GitHub Web UI (Recommended for First Time)

1. Go to [github.com/new](https://github.com/new)
2. Fill in details:
   - **Repository name**: `mystweaver`
   - **Description**: "An open-source, self-hosted feature flag service"
   - **Visibility**: Public (for open-source)
   - **Initialize**: Leave unchecked (we have local commits)
3. Click "Create Repository"
4. Copy the repository URL (e.g., `https://github.com/yourusername/mystweaver.git`)

### Option B: GitHub CLI

```bash
# If you have GitHub CLI installed
gh repo create mystweaver \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description="An open-source, self-hosted feature flag service"
```

---

## Pushing to GitHub

### Step 1: Add Remote

```bash
# Replace with your actual repository URL
git remote add origin https://github.com/yourusername/mystweaver.git

# Verify remote
git remote -v
```

### Step 2: Rename Default Branch (If Needed)

GitHub defaults to `main`, but if yours is `master`:

```bash
git branch -M main
```

### Step 3: Push to GitHub

```bash
# Push all commits and set upstream
git push -u origin main

# Verify
git branch -vv
```

### Step 4: Verify Repository

Visit: `https://github.com/yourusername/mystweaver`

You should see:

- All project files
- Commit history
- README.md displayed
- All GitHub issue and PR templates in `.github/`

---

## GitHub Configuration

### Step 1: Enable Branch Protection

1. Go to **Settings** → **Branches**
2. Click **Add rule** under "Branch protection rules"
3. Pattern: `main`
4. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
5. Click **Create**

### Step 2: Configure Status Checks

1. Go to **Settings** → **Branches** → Edit branch protection rule for `main`
2. Under "Status checks that must pass before merging", select:
   - ✅ `lint`
   - ✅ `typecheck`
   - ✅ `test`
   - ✅ `build`
3. Save

### Step 3: Create GitHub Actions Secrets (For Deployment)

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these after completing [GCP Setup](./GCP_SETUP.md):
   - `GCP_PROJECT_ID`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT_EMAIL`
   - `GCP_REGION`

### Step 4: Enable Discussions (Optional)

1. Go to **Settings** → **General**
2. Scroll to "Features"
3. Enable ✅ **Discussions**
4. This allows community conversations outside of issues

### Step 5: Create Main Release (Optional)

```bash
# Create a release tag
git tag -a v0.1.0 -m "Initial release - Project scaffold"
git push origin v0.1.0

# Or use GitHub CLI
gh release create v0.1.0 --generate-notes
```

---

## Verification Checklist

After pushing, verify:

- [ ] Repository is public (or private, as intended)
- [ ] All files visible on GitHub
- [ ] README.md displayed on main page
- [ ] GitHub Actions CI workflow runs on push
- [ ] Issue templates visible when creating new issue
- [ ] PR template visible when creating pull request
- [ ] Branch protection enabled on `main`
- [ ] Status checks configured

---

## Local Workflow (Going Forward)

### Creating a Feature Branch

```bash
git checkout -b feature/add-flag-evaluation
```

### Making Commits

```bash
git add apps/api/src/evaluator.ts
git commit -m "feat(api): implement flag evaluation logic"
```

### Creating a Pull Request

```bash
git push origin feature/add-flag-evaluation
# Then open PR on GitHub, or use:
gh pr create --title "Add flag evaluation logic" --body "Implements core flag evaluation engine"
```

### After Review and CI Passes

Merge via GitHub UI (recommended to maintain linear history):

- Select **"Squash and merge"** for cleaner history, or
- Select **"Create a merge commit"** to preserve commits

---

## Protecting Against Accidental Pushes

### Create Local Pre-commit Hook

```bash
# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Prevent pushing service account keys
if git diff --cached | grep -q "service-account-key\|.gcloud\|GOOGLE_APPLICATION_CREDENTIALS"; then
  echo "Error: Attempting to commit secrets!"
  exit 1
fi

# Run linting before commit
npm run lint

# Run type check before commit
npm run typecheck
EOF

chmod +x .git/hooks/pre-commit
```

---

## Useful Commands

```bash
# View commit history
git log --oneline

# View remote status
git remote -v

# View branches
git branch -a

# Pull latest changes
git pull origin main

# Stash uncommitted changes
git stash

# View status
git status
```

---

## Next Steps

1. **GCP Setup**: Follow [GCP_SETUP.md](./GCP_SETUP.md) to connect GitHub Actions to GCP
2. **Terraform**: Create GCP infrastructure definitions in `infra/terraform/`
3. **Development**: Start implementing features following [CONTRIBUTING.md](./CONTRIBUTING.md)
4. **Documentation**: Build out API docs, SDK docs, and deployment guides

---

## Troubleshooting

### Push Rejected: "The current branch main has no upstream branch"

```bash
git push -u origin main
```

### Remote URL Wrong

```bash
# View current remote
git remote -v

# Update remote URL
git remote set-url origin https://github.com/yourusername/mystweaver.git
```

### Forgot to Configure User

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### Want to Change Branch Protection After Pushing

Just go to Settings → Branches and add a rule for `main` anytime.

---

For more information on branch protection, see:
[GitHub Docs: Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
