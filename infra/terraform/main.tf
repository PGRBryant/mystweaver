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

  # Retain undelivered messages for 7 days.
  message_retention_duration = "604800s"

  depends_on = [google_project_service.apis]
}

# Dead-letter topic for messages that fail after max_delivery_attempts.
resource "google_pubsub_topic" "flag_updates_dlq" {
  name = "flag-updates-dlq"

  depends_on = [google_project_service.apis]
}

# Managed subscription (previously auto-created at runtime).
resource "google_pubsub_subscription" "flag_updates_api" {
  name  = "flag-updates-api"
  topic = google_pubsub_topic.flag_updates.name

  ack_deadline_seconds = 20

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.flag_updates_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

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

resource "google_project_iam_member" "api_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
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

# ── Cloud Run API service ─────────────────────────────────────────────────────
# Terraform creates and owns the service configuration (env vars, SA, scaling).
# The container image is managed by CI/CD (deploy.yml) — Terraform ignores it
# after initial creation to avoid stepping on in-flight deployments.

resource "google_cloud_run_v2_service" "api" {
  name     = "mystweaver-api"
  location = var.region

  template {
    service_account = google_service_account.api.email

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
        name  = "CORS_ORIGINS"
        value = "https://${var.domain},https://room404.dev,https://*.room404.dev${var.verika_domain != "" ? ",https://${var.verika_domain}" : ""},http://localhost:5173,http://localhost:5174"
      }
      env {
        name  = "AUTH_PROVIDER"
        value = var.auth_provider
      }
      env {
        name  = "VERIKA_ENDPOINT"
        value = var.verika_domain != "" ? "https://${var.verika_domain}" : ""
      }
      env {
        name  = "VERIKA_SERVICE_ID"
        value = var.verika_service_id
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
          path = "/health/live"
          port = 3000
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health/live"
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
    google_secret_manager_secret_version.api_signing_key_initial,
  ]
}

# ── Cloud Run Admin UI service (behind IAP) ──────────────────────────────

resource "google_service_account" "web" {
  account_id   = "mystweaver-web"
  display_name = "Mystweaver Admin UI Runtime"
  description  = "Service account used by the Cloud Run Admin UI service"
}

resource "google_cloud_run_v2_service" "web" {
  name     = "mystweaver-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.web.email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      # Placeholder on first apply — CI/CD owns image updates thereafter.
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.mystweaver.repository_id}/web:latest"

      ports {
        container_port = 80
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "MYSTWEAVER_API_URL"
        value = google_cloud_run_v2_service.api.uri
      }

      startup_probe {
        http_get {
          path = "/"
          port = 80
        }
        initial_delay_seconds = 2
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 3
      }
    }
  }

  # CI/CD (deploy.yml) controls image updates — Terraform only manages infra config.
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.api,
  ]
}

# IAP brand + OAuth client for the Admin UI.
# NOTE: The OAuth consent screen (brand) must be configured manually in the
# GCP console the first time. Terraform can manage the IAP backend binding
# once the brand exists. For now, restrict access via IAM on the Cloud Run
# service invoker role — only authenticated users with the role can reach it.

# Allow unauthenticated access to the API — the app handles its own auth
# (SDK key Bearer tokens for SDK endpoints, IAP for admin endpoints).
resource "google_cloud_run_v2_service_iam_member" "api_noauth" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_noauth" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Cloud Monitoring Alert Policies ──────────────────────────────────────

# Notification channel — email alert target.
# Additional channels (PagerDuty, Slack) can be added here.
resource "google_monitoring_notification_channel" "email" {
  display_name = "Mystweaver Alerts Email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

# Alert: API p99 latency > 500ms
resource "google_monitoring_alert_policy" "api_latency" {
  display_name = "Mystweaver API p99 latency > 500ms"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run request latency p99 > 500ms"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"mystweaver-api\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 500
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# Alert: API error rate > 1%
resource "google_monitoring_alert_policy" "api_error_rate" {
  display_name = "Mystweaver API error rate > 1%"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx error rate > 1%"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"mystweaver-api\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.01
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# Alert: SSE connection count drops to 0 unexpectedly
# TODO(V2): Uncomment once sse_connections_active is exported to Cloud Monitoring
# via OpenTelemetry sidecar. The metric currently only exists in Prometheus format
# at /metrics and Cloud Monitoring rejects alert policies referencing unknown metrics.
#
# resource "google_monitoring_alert_policy" "sse_connections_drop" {
#   display_name = "Mystweaver SSE connections dropped to 0"
#   combiner     = "OR"
#
#   conditions {
#     display_name = "SSE active connections == 0"
#     condition_threshold {
#       filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"mystweaver-api\" AND metric.type = \"custom.googleapis.com/sse_connections_active\""
#       comparison      = "COMPARISON_LT"
#       threshold_value = 1
#       duration        = "600s"
#       aggregations {
#         alignment_period     = "300s"
#         per_series_aligner   = "ALIGN_MEAN"
#         cross_series_reducer = "REDUCE_SUM"
#         group_by_fields      = ["resource.labels.service_name"]
#       }
#     }
#   }
#   notification_channels = [google_monitoring_notification_channel.email.id]
#   alert_strategy { auto_close = "1800s" }
#   depends_on = [google_project_service.apis]
# }
