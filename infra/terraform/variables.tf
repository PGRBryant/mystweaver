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

variable "redis_tier" {
  description = "Redis service tier: BASIC (no replication) or STANDARD_HA (high-availability)"
  type        = string
  default     = "BASIC"

  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "redis_tier must be BASIC or STANDARD_HA."
  }
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
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

variable "iap_members" {
  description = "IAM members allowed through IAP (e.g., [\"user:you@gmail.com\"])"
  type        = list(string)
}
