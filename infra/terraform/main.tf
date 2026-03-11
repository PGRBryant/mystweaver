terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure after bootstrapping GCS bucket for state:
  # backend "gcs" {
  #   bucket = "your-project-id-tfstate"
  #   prefix = "labrats/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Enable required APIs ─────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "redis.googleapis.com",
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudtrace.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "iap.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# ── Artifact Registry (Docker images) ────────────────────────────────────────

resource "google_artifact_registry_repository" "labrats" {
  repository_id = "labrats"
  location      = var.region
  format        = "DOCKER"
  description   = "Labrats container images"

  depends_on = [google_project_service.apis]
}

# ── Firestore (Native mode) ───────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# ── Pub/Sub topic for flag change fanout ─────────────────────────────────────

resource "google_pubsub_topic" "flag_updates" {
  name = "flag-updates"

  depends_on = [google_project_service.apis]
}

# ── Cloud Run service account ─────────────────────────────────────────────────

resource "google_service_account" "api" {
  account_id   = "labrats-api"
  display_name = "Labrats API Runtime"
  description  = "Service account used by the Cloud Run API service"
}

resource "google_project_iam_member" "api_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_trace" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ── Workload Identity Federation for GitHub Actions ──────────────────────────

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions CI/CD"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  account_id   = "github-actions-deployer"
  display_name = "GitHub Actions Deployer"
  description  = "Impersonated by GitHub Actions via Workload Identity Federation"
}

resource "google_service_account_iam_member" "github_wif_binding" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

resource "google_project_iam_member" "github_actions_run" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_ar" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}
