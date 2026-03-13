variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run and Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Firestore multi-region or region location ID (e.g. nam5, eur3, us-central)"
  type        = string
  default     = "nam5"
}

variable "github_org" {
  description = "GitHub username or organization that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix)"
  type        = string
  default     = "mystweaver"
}

variable "alert_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
}

variable "domain" {
  description = "Domain name for the load balancer SSL certificate"
  type        = string
}

variable "iap_oauth_client_id" {
  description = "OAuth 2.0 client ID for IAP (created in GCP Console)"
  type        = string
  sensitive   = true
}

variable "iap_oauth_client_secret" {
  description = "OAuth 2.0 client secret for IAP (created in GCP Console)"
  type        = string
  sensitive   = true
}

