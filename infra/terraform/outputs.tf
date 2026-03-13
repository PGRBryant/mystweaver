output "artifact_registry_url" {
  description = "Docker registry URL for pushing/pulling images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.mystweaver.repository_id}"
}

output "workload_identity_provider" {
  description = "Full WIF provider resource name — set as GCP_WORKLOAD_IDENTITY_PROVIDER in GitHub secrets"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_service_account" {
  description = "Service account email for GitHub Actions — set as GCP_SERVICE_ACCOUNT_EMAIL in GitHub secrets"
  value       = google_service_account.github_actions.email
}

output "api_service_account" {
  description = "Service account email for the Cloud Run API service"
  value       = google_service_account.api.email
}

output "cloud_run_url" {
  description = "Public URL of the deployed Cloud Run API service"
  value       = google_cloud_run_v2_service.api.uri
}

output "web_service_url" {
  description = "Public URL of the deployed Cloud Run Admin UI service"
  value       = google_cloud_run_v2_service.web.uri
}

output "load_balancer_ip" {
  description = "Static IP of the HTTPS load balancer — point DNS A record here"
  value       = google_compute_global_address.default.address
}

output "app_url" {
  description = "Public URL of Mystweaver (via load balancer)"
  value       = "https://${var.domain}"
}
