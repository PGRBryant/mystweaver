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
  default     = "labrats"
}
