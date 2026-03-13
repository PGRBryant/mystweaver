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

output "redis_host" {
  description = "Internal IP of the Redis instance (accessible via VPC connector)"
  value       = google_redis_instance.cache.host
}

output "web_service_url" {
  description = "Public URL of the deployed Cloud Run Admin UI service"
  value       = google_cloud_run_v2_service.web.uri
}
