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

variable "verika_domain" {
  description = "Domain of the Verika identity service (e.g. verika.example.com). Added to CORS allowed origins."
  type        = string
  default     = ""
}

variable "verika_service_id" {
  description = "Service ID assigned to Mystweaver in Verika's service registry (VERIKA_SERVICE_ID env var)"
  type        = string
  default     = ""
}

variable "auth_provider" {
  description = "Auth provider for admin endpoints: 'google-iap' (default), 'verika', or 'dev'"
  type        = string
  default     = "google-iap"
}

