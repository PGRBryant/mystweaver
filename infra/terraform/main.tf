terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure after bootstrapping GCS bucket for state:
   backend "gcs" {
     bucket = "mystweaver-489920-tfstate"
     prefix = "mystweaver/state"
   }
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
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# ── Artifact Registry (Docker images) ────────────────────────────────────────

resource "google_artifact_registry_repository" "mystweaver" {
  repository_id = "mystweaver"
  location      = var.region
  format        = "DOCKER"
  description   = "Mystweaver container images"

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
  account_id   = "mystweaver-api"
  display_name = "Mystweaver API Runtime"
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

resource "google_project_iam_member" "api_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ── Secret Manager ──────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "api_signing_key" {
  secret_id = "api-signing-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "api_signing_key_initial" {
  secret      = google_secret_manager_secret.api_signing_key.id
  secret_data = "CHANGE_ME_ON_FIRST_DEPLOY"

  lifecycle {
    ignore_changes = [secret_data]
  }
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

  attribute_condition = "assertion.repository_owner == \"${var.github_org}\""

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

# ── VPC Access Connector (Cloud Run → Redis) ──────────────────────────────────

resource "google_vpc_access_connector" "default" {
  name          = "mystweaver-connector"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = "default"

  depends_on = [google_project_service.apis]
}

# ── Cloud Memorystore (Redis) ─────────────────────────────────────────────────

resource "google_redis_instance" "cache" {
  name           = "mystweaver-cache"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  redis_version  = "REDIS_7_0"
  display_name   = "Mystweaver cache"

  depends_on = [google_project_service.apis]
}

# ── Cloud Run API service ─────────────────────────────────────────────────────
# Terraform creates and owns the service configuration (env vars, SA, scaling).
# The container image is managed by CI/CD (deploy.yml) — Terraform ignores it
# after initial creation to avoid stepping on in-flight deployments.

resource "google_cloud_run_v2_service" "api" {
  name     = "mystweaver-api"
  location = var.region

  template {
    service_account = google_service_account.api.email

    vpc_access {
      connector = google_vpc_access_connector.default.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      # Placeholder on first apply — CI/CD owns image updates thereafter.
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.mystweaver.repository_id}/api:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }
      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.cache.port)
      }
      env {
        name = "API_SIGNING_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.api_signing_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  # CI/CD (deploy.yml) controls image updates — Terraform only manages infra config.
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.apis,
    google_redis_instance.cache,
    google_vpc_access_connector.default,
    google_secret_manager_secret_version.api_signing_key_initial,
  ]
}
