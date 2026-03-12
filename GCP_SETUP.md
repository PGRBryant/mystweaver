# GCP Setup Guide

This guide connects Mystweaver to GCP in four phases. **Do them in order.**

```
Phase 1 → Prerequisites     (install tools, create project)
Phase 2 → Bootstrap         (one-time manual GCP prep — run bootstrap.sh)
Phase 3 → Terraform         (provisions all infrastructure)
Phase 4 → GitHub secrets    (connects CI/CD to GCP)
```

---

## Phase 1: Prerequisites

### 1.1 Tools

Install the following on your local machine:

| Tool         | Version | Install                                                                                |
| ------------ | ------- | -------------------------------------------------------------------------------------- |
| `gcloud` CLI | latest  | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)                      |
| `terraform`  | >= 1.6  | [developer.hashicorp.com/terraform](https://developer.hashicorp.com/terraform/install) |

Verify:

```bash
gcloud version
terraform version
```

### 1.2 GCP project

You need a GCP project with **billing enabled**. If you don't have one:

```bash
# Create a new project (billing must be linked manually in the console)
gcloud projects create mystweaver-prod --name="Mystweaver"

# Or use an existing project — just note the project ID:
gcloud projects list
```

> **Billing is required.** Firestore, Cloud Run, Redis, and Artifact Registry are not free-tier services.
> Link billing at: console.cloud.google.com → Billing → Link a billing account

---

## Phase 2: Bootstrap (run once)

Terraform manages all GCP infrastructure — but it cannot bootstrap itself.
Before running Terraform you need:

- A GCS bucket to store Terraform state
- Two APIs enabled that the Terraform Google provider itself depends on

The `infra/bootstrap.sh` script handles both.

### 2.1 Run the bootstrap script

```bash
export PROJECT_ID="your-gcp-project-id"
export GITHUB_ORG="yourusername"           # GitHub username or org name
export REGION="us-central1"               # optional, defaults to us-central1

bash infra/bootstrap.sh
```

The script will:

1. Prompt for `gcloud auth login`
2. Enable `cloudresourcemanager.googleapis.com` and `storage.googleapis.com`
3. Create a versioned GCS bucket named `${PROJECT_ID}-tfstate`
4. Print the exact backend config to paste into `main.tf` and the next steps

### 2.2 Configure the Terraform backend

The bootstrap script prints the exact snippet. Open `infra/terraform/main.tf` and
uncomment + fill in the `backend "gcs"` block:

```hcl
backend "gcs" {
  bucket = "your-project-id-tfstate"   # ← printed by bootstrap.sh
  prefix = "mystweaver/state"
}
```

> **Why remote state?** The GCS backend means state is shared across your
> team and CI/CD — no one loses it if a laptop dies, and Terraform locks it
> to prevent concurrent runs.

---

## Phase 3: Terraform

Terraform provisions everything else:

| Resource                     | What it creates                                           |
| ---------------------------- | --------------------------------------------------------- |
| APIs                         | Enables all required GCP APIs                             |
| Artifact Registry            | Docker registry for container images                      |
| Firestore                    | Native-mode database                                      |
| Cloud Memorystore            | Redis 7 cache instance                                    |
| VPC Access Connector         | Private network bridge (Cloud Run → Redis)                |
| Cloud Run                    | API service (placeholder image, CI/CD owns image updates) |
| Pub/Sub                      | `flag-updates` topic for flag change fanout               |
| Service Accounts             | Runtime SA for Cloud Run, deployer SA for GitHub Actions  |
| Workload Identity Federation | Keyless auth for GitHub Actions                           |
| IAM bindings                 | Least-privilege roles for each service account            |

### 3.1 Copy and fill in tfvars

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Edit `terraform.tfvars` — the required fields are:

```hcl
project_id = "your-gcp-project-id"
github_org = "yourusername"
```

The rest have sensible defaults (`us-central1`, BASIC Redis, etc.).

### 3.2 Authenticate for Terraform

Terraform runs locally using your own credentials on first apply:

```bash
gcloud auth application-default login
```

### 3.3 Init, plan, apply

```bash
cd infra/terraform

terraform init      # downloads providers, connects to GCS backend
terraform plan      # preview — review before applying
terraform apply     # provisions everything (~5–10 minutes)
```

Terraform will create ~25 resources. The first apply takes longer because it
waits for APIs to enable before creating dependent resources.

### 3.4 Verify outputs

```bash
terraform output
```

You should see something like:

```
artifact_registry_url             = "us-central1-docker.pkg.dev/your-project/mystweaver"
cloud_run_url                     = "https://mystweaver-api-xxxx-uc.a.run.app"
github_actions_service_account    = "github-actions-deployer@your-project.iam.gserviceaccount.com"
workload_identity_provider        = "projects/123/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
redis_host                        = "10.x.x.x"
```

Save these — you need them in Phase 4.

---

## Phase 4: GitHub Secrets

GitHub Actions uses these secrets to authenticate to GCP without any
long-lived keys (Workload Identity Federation).

### 4.1 Add secrets to GitHub

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret name                      | Value                                                  |
| -------------------------------- | ------------------------------------------------------ |
| `GCP_PROJECT_ID`                 | Your GCP project ID                                    |
| `GCP_REGION`                     | `us-central1` (or your chosen region)                  |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | From `terraform output workload_identity_provider`     |
| `GCP_SERVICE_ACCOUNT_EMAIL`      | From `terraform output github_actions_service_account` |

Or use the GitHub CLI (faster):

```bash
PROVIDER=$(cd infra/terraform && terraform output -raw workload_identity_provider)
SA=$(cd infra/terraform && terraform output -raw github_actions_service_account)

gh secret set GCP_PROJECT_ID        --body "$PROJECT_ID"
gh secret set GCP_REGION            --body "us-central1"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$PROVIDER"
gh secret set GCP_SERVICE_ACCOUNT_EMAIL      --body "$SA"
```

### 4.2 Test the connection

Push any commit to `main` (or trigger the workflow manually):

```bash
gh workflow run deploy.yml
gh run list --workflow=deploy.yml --limit=1
```

The deploy workflow will:

1. Build the Docker image and push it to Artifact Registry
2. Deploy the new image to Cloud Run
3. Print the live service URL

### 4.3 Verify the deployment

```bash
# Get the Cloud Run URL
URL=$(cd infra/terraform && terraform output -raw cloud_run_url)

# Hit the health endpoint
curl "$URL/health"
# → {"status":"ok","timestamp":"..."}
```

---

## Ongoing: Making infrastructure changes

After the initial setup, all GCP changes go through Terraform:

```bash
# Edit infra/terraform/*.tf
# Then:
cd infra/terraform
terraform plan    # always review first
terraform apply
```

Never make manual changes in the GCP Console — they will be overwritten by
the next `terraform apply` and won't be tracked in version control.

---

## Troubleshooting

### `Error: googleapi: Error 403: ... has not been used in project`

An API isn't enabled yet. Wait 30 seconds and re-run `terraform apply` — API
propagation sometimes lags resource creation.

### `Error: Error creating GCS bucket: ... already exists`

The state bucket already exists (perhaps from a previous attempt). The
bootstrap script handles this gracefully — it skips creation if the bucket
is already present.

### GitHub Actions: `Unable to generate access token`

The WIF provider or IAM binding isn't correctly set up. Check:

```bash
# Verify the binding exists
gcloud iam service-accounts get-iam-policy \
  $(cd infra/terraform && terraform output -raw github_actions_service_account) \
  --project="$PROJECT_ID"
```

Also confirm the workflow has `permissions: id-token: write` — this is
required for WIF to work.

### `Permission denied` deploying to Cloud Run

The GitHub Actions service account is missing `roles/run.admin`. This is
granted by Terraform — re-run `terraform apply` to reconcile any drift.

---

## Cleanup

To tear down all GCP resources provisioned by Terraform:

```bash
cd infra/terraform
terraform destroy
```

Then delete the state bucket manually (Terraform cannot delete its own backend):

```bash
gcloud storage rm -r "gs://${PROJECT_ID}-tfstate"
```
