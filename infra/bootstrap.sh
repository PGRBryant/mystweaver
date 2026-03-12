#!/usr/bin/env bash
# ============================================================================
# Mystweaver — GCP Bootstrap Script
#
# Run this ONCE before `terraform init` to create the prerequisites that
# Terraform cannot create for itself:
#   1. GCS bucket for remote Terraform state
#   2. APIs that must be enabled before the Google Terraform provider can run
#
# Usage:
#   export PROJECT_ID="your-gcp-project-id"
#   export GITHUB_ORG="yourusername"   # GitHub username or org
#   bash infra/bootstrap.sh
# ============================================================================

set -euo pipefail

# ── Validate required inputs ─────────────────────────────────────────────────

if [[ -z "${PROJECT_ID:-}" ]]; then
  echo "ERROR: PROJECT_ID is not set."
  echo "  export PROJECT_ID=\"your-gcp-project-id\""
  exit 1
fi

if [[ -z "${GITHUB_ORG:-}" ]]; then
  echo "ERROR: GITHUB_ORG is not set."
  echo "  export GITHUB_ORG=\"yourusername\""
  exit 1
fi

REGION="${REGION:-us-central1}"
STATE_BUCKET="${PROJECT_ID}-tfstate"

echo ""
echo "================================================================"
echo "  Mystweaver GCP Bootstrap"
echo "================================================================"
echo "  Project ID    : $PROJECT_ID"
echo "  Region        : $REGION"
echo "  GitHub org    : $GITHUB_ORG"
echo "  State bucket  : gs://$STATE_BUCKET"
echo "================================================================"
echo ""

# ── Authenticate ─────────────────────────────────────────────────────────────

echo "→ Authenticating with Google Cloud..."
gcloud auth login --quiet
gcloud config set project "$PROJECT_ID" --quiet

echo "→ Verifying project exists and is accessible..."
gcloud projects describe "$PROJECT_ID" --format="value(projectId)" > /dev/null

# ── Enable bootstrap APIs ─────────────────────────────────────────────────────
# These must be enabled before the Terraform Google provider can enable anything
# else. They are not included in Terraform's API enablement block for this reason.

echo ""
echo "→ Enabling bootstrap APIs (cloudresourcemanager, storage)..."
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

echo "   Done."

# ── Create GCS bucket for Terraform state ────────────────────────────────────

echo ""
echo "→ Creating Terraform state bucket: gs://$STATE_BUCKET"

if gcloud storage buckets describe "gs://$STATE_BUCKET" --project="$PROJECT_ID" &>/dev/null; then
  echo "   Bucket already exists — skipping."
else
  gcloud storage buckets create "gs://$STATE_BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access

  # Enable versioning so you can recover from accidental state corruption
  gcloud storage buckets update "gs://$STATE_BUCKET" \
    --versioning

  echo "   Bucket created with versioning enabled."
fi

# ── Print next steps ──────────────────────────────────────────────────────────

echo ""
echo "================================================================"
echo "  Bootstrap complete! Next steps:"
echo "================================================================"
echo ""
echo "1. Uncomment and fill in the backend block in infra/terraform/main.tf:"
echo ""
echo '   backend "gcs" {'
echo "     bucket = \"$STATE_BUCKET\""
echo '     prefix = "mystweaver/state"'
echo '   }'
echo ""
echo "2. Copy and fill in your tfvars:"
echo ""
echo "   cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars"
echo ""
echo "   Required values:"
echo "     project_id = \"$PROJECT_ID\""
echo "     github_org = \"$GITHUB_ORG\""
echo ""
echo "3. Initialize and apply Terraform:"
echo ""
echo "   cd infra/terraform"
echo "   terraform init"
echo "   terraform plan"
echo "   terraform apply"
echo ""
echo "4. Add GitHub Actions secrets from Terraform output:"
echo ""
echo "   terraform output workload_identity_provider"
echo "   terraform output github_actions_service_account"
echo ""
echo "   Add to GitHub → Settings → Secrets and variables → Actions:"
echo "     GCP_PROJECT_ID                = $PROJECT_ID"
echo "     GCP_REGION                    = $REGION"
echo "     GCP_WORKLOAD_IDENTITY_PROVIDER = (from terraform output)"
echo "     GCP_SERVICE_ACCOUNT_EMAIL      = (from terraform output)"
echo ""
echo "================================================================"
