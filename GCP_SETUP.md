# Deployment Guide: GitHub → GCP via Workload Identity Federation

This guide walks you through setting up **Workload Identity Federation** to allow GitHub Actions to deploy to GCP **without long-lived service account keys**.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GCP Setup](#gcp-setup)
3. [GitHub Setup](#github-setup)
4. [Verification](#verification)
5. [Example Deployment Workflow](#example-deployment-workflow)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### GCP Requirements
- An active GCP project with billing enabled
- `gcloud` CLI installed locally
- Appropriate IAM roles:
  - `Workload Identity Pool Admin` (for setup)
  - `Service Account Admin` (to create service accounts)

### GitHub Requirements
- Repository owner access
- GitHub organization (recommended but not required)

### Recommended Tools
```bash
# Install gcloud CLI
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Verify installation
gcloud version
```

---

## GCP Setup

### Step 1: Set Environment Variables

```bash
# Replace these values with your own
export PROJECT_ID="your-gcp-project-id"
export GITHUB_ORG="yourusername"  # GitHub username or org
export GITHUB_REPO="labrats"
export REGION="us-central1"
export WORKLOAD_IDENTITY_POOL_ID="github-pool"
export WORKLOAD_IDENTITY_PROVIDER_ID="github-provider"
export SERVICE_ACCOUNT_NAME="github-actions-deployer"

# Verify
echo "Project: $PROJECT_ID"
echo "Repo: $GITHUB_ORG/$GITHUB_REPO"
```

### Step 2: Enable Required APIs

```bash
gcloud services enable \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com \
  iamcredentials.googleapis.com \
  --project=$PROJECT_ID
```

### Step 3: Create Workload Identity Pool

```bash
# Create the pool
gcloud iam workload-identity-pools create $WORKLOAD_IDENTITY_POOL_ID \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# Get the pool resource name (save this)
WORKLOAD_IDENTITY_POOL_RESOURCE=$(gcloud iam workload-identity-pools describe \
  $WORKLOAD_IDENTITY_POOL_ID \
  --project=$PROJECT_ID \
  --location=global \
  --format='value(name)')

echo "Pool Resource: $WORKLOAD_IDENTITY_POOL_RESOURCE"
```

### Step 4: Create Workload Identity Provider

```bash
# Create OIDC provider for GitHub
gcloud iam workload-identity-pools providers create-oidc $WORKLOAD_IDENTITY_PROVIDER_ID \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL_ID \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.environment=assertion.environment" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Save the provider resource name
WORKLOAD_IDENTITY_PROVIDER_RESOURCE=$(gcloud iam workload-identity-pools providers describe \
  $WORKLOAD_IDENTITY_PROVIDER_ID \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL_ID \
  --format='value(name)')

echo "Provider Resource: $WORKLOAD_IDENTITY_PROVIDER_RESOURCE"
```

### Step 5: Create Service Account

```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deployer" \
  --description="Service account for GitHub Actions CI/CD"

# Get the service account email
SERVICE_ACCOUNT_EMAIL=$(gcloud iam service-accounts describe \
  $SERVICE_ACCOUNT_NAME \
  --project=$PROJECT_ID \
  --format='value(email)')

echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
```

### Step 6: Grant Service Account Permissions

```bash
# Grant Cloud Run Admin role (for deploying)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin" \
  --condition=None

# Grant Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None

# Grant Artifact Registry Writer (for pushing images)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/artifactregistry.writer" \
  --condition=None

# Grant Logging Writer (for logs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/logging.logWriter" \
  --condition=None
```

### Step 7: Configure Workload Identity Binding

```bash
# Create the attribute condition (repository check)
ATTRIBUTE_CONDITION='assertion.repository_owner == "'$GITHUB_ORG'" && assertion.repository == "'$GITHUB_ORG'/'$GITHUB_REPO'"'

echo "Attribute Condition: $ATTRIBUTE_CONDITION"

# Add IAM binding to allow GitHub to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --principal="principalSet://iam.googleapis.com/$WORKLOAD_IDENTITY_PROVIDER_RESOURCE/attribute.repository/$GITHUB_ORG/$GITHUB_REPO"
```

### Step 8: Save Configuration for GitHub

```bash
# Create a summary file with all values needed in GitHub
cat > gcp-config.env << EOF
GCP_PROJECT_ID=$PROJECT_ID
GCP_WORKLOAD_IDENTITY_PROVIDER=$WORKLOAD_IDENTITY_PROVIDER_RESOURCE
GCP_SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL
GCP_REGION=$REGION
EOF

echo "Configuration saved to gcp-config.env"
cat gcp-config.env
```

---

## GitHub Setup

### Step 1: Add GitHub Secrets

Navigate to: **Settings** → **Secrets and variables** → **Actions**

Add the following secrets:

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | From `gcp-config.env` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | From `gcp-config.env` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | From `gcp-config.env` |
| `GCP_REGION` | `us-central1` (or your chosen region) |

### Step 2: Verify Secrets

```bash
# List secrets (don't show values)
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/$GITHUB_ORG/$GITHUB_REPO/actions/secrets
```

---

## Example Deployment Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run build --workspace=@labrats/api

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: |
          gcloud auth configure-docker ${{ secrets.GCP_REGION }}-docker.pkg.dev

      - name: Build and Push Docker Image
        run: |
          docker build -t ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/labrats/api:${{ github.sha }} .
          docker push ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/labrats/api:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy labrats-api \
            --image ${{ secrets.GCP_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/labrats/api:${{ github.sha }} \
            --region ${{ secrets.GCP_REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --set-env-vars NODE_ENV=production
```

---

## Verification

### Step 1: Test Workload Identity

```bash
# Test that the setup works by running a simple GCP command
gcloud config set project $PROJECT_ID

# Verify service account has permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:$SERVICE_ACCOUNT_EMAIL" \
  --format='table(bindings.role)'
```

### Step 2: Test GitHub Actions Workflow

Push a test workflow or manually trigger:

```bash
# Terminal: Wait for workflow to complete
gh run list --repo $GITHUB_ORG/$GITHUB_REPO --branch main --limit 1

# View logs
gh run view <run-id> --repo $GITHUB_ORG/$GITHUB_REPO --log
```

### Step 3: Verify Deployment

```bash
# Check Cloud Run service
gcloud run services list --region=$REGION

# View service details
gcloud run services describe labrats-api \
  --region=$REGION \
  --format='value(status.url)'
```

---

## Troubleshooting

### Issue: `Unable to generate access token` in GitHub Actions

**Cause**: Workload Identity Provider not correctly configured or credentials not passed to gcloud.

**Solution**:
```yaml
# Ensure correct permissions in workflow
permissions:
  contents: read
  id-token: write  # THIS IS REQUIRED
```

### Issue: `Permission denied` when deploying to Cloud Run

**Cause**: Service account missing required roles.

**Solution**:
```bash
# Verify roles
gcloud iam service-accounts get-iam-policy $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID

# Re-grant roles if necessary
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"
```

### Issue: `Failed to pull image` from Artifact Registry

**Cause**: Service account not authenticated to Docker registry.

**Solution**:
```bash
# Ensure gcloud is authenticated and Docker is configured
gcloud auth configure-docker $REGION-docker.pkg.dev
```

### Issue: `OIDC token rejected`

**Cause**: GitHub token doesn't match the repository condition.

**Solution**:
```bash
# Verify the attribute condition
gcloud iam workload-identity-pools providers describe $WORKLOAD_IDENTITY_PROVIDER_ID \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL_ID \
  --location=global \
  --project=$PROJECT_ID
```

---

## Cleanup (If Needed)

```bash
# Delete Workload Identity Provider
gcloud iam workload-identity-pools providers delete $WORKLOAD_IDENTITY_PROVIDER_ID \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL_ID \
  --location=global \
  --project=$PROJECT_ID

# Delete Workload Identity Pool
gcloud iam workload-identity-pools delete $WORKLOAD_IDENTITY_POOL_ID \
  --location=global \
  --project=$PROJECT_ID

# Delete Service Account
gcloud iam service-accounts delete $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID
```

---

## Security Best Practices

1. **Limit Scope**: Use attribute conditions to limit which repositories can use this service account
2. **Environment-Specific SA**: Create separate service accounts per environment (staging, production)
3. **Regular Audits**: Review role grants regularly with:
   ```bash
   gcloud projects get-iam-policy $PROJECT_ID
   ```
4. **No Key Export**: Never create or download service account keys—Workload Identity eliminates this
5. **Rotate Attributes**: If you need to rotate credentials, simply update attribute conditions

---

## Next Steps

- Create Artifact Registry repository for Docker images
- Set up Cloud Run services with appropriate environment variables
- Configure Terraform to manage GCP infrastructure as code
- Set up Cloud Monitoring and Cloud Logging alerts

For more information:
- [Workload Identity Federation](https://cloud.google.com/docs/authentication/workload-identity-federation)
- [GitHub Actions Google Cloud Auth](https://github.com/google-github-actions/auth)
- [Cloud Run Deployment](https://cloud.google.com/run/docs/deploying)
