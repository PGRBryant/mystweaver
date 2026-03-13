# ── Global HTTPS Load Balancer ─────────────────────────────────────────────
# Routes traffic to Cloud Run services with path-based routing:
#   /*        → mystweaver-web  (IAP ON  — admin UI)
#   /api/*    → mystweaver-api  (IAP ON  — admin endpoints)
#   /sdk/*    → mystweaver-api  (IAP OFF — SDK endpoints, Bearer auth)
#   /health   → mystweaver-api  (IAP OFF)
#   /metrics  → mystweaver-api  (IAP OFF)

# ── Static IP ─────────────────────────────────────────────────────────────

resource "google_compute_global_address" "default" {
  name = "mystweaver-lb-ip"

  depends_on = [google_project_service.apis]
}

# ── Serverless NEGs (Cloud Run backends) ──────────────────────────────────

resource "google_compute_region_network_endpoint_group" "api" {
  name                  = "mystweaver-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_region_network_endpoint_group" "web" {
  name                  = "mystweaver-web-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.web.name
  }
}

# ── Backend Services ──────────────────────────────────────────────────────

# Admin UI — IAP protected
resource "google_compute_backend_service" "web" {
  name                  = "mystweaver-web-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.web.id
  }

  iap {
    oauth2_client_id     = var.iap_oauth_client_id
    oauth2_client_secret = var.iap_oauth_client_secret
  }
}

# Admin API — IAP protected (same IAP config, different backend)
resource "google_compute_backend_service" "api_admin" {
  name                  = "mystweaver-api-admin-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }

  iap {
    oauth2_client_id     = var.iap_oauth_client_id
    oauth2_client_secret = var.iap_oauth_client_secret
  }
}

# SDK endpoints — public (Bearer token auth handled by the app)
resource "google_compute_backend_service" "api_public" {
  name                  = "mystweaver-api-public-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }
}

# ── URL Map (path-based routing) ──────────────────────────────────────────

resource "google_compute_url_map" "default" {
  name            = "mystweaver-url-map"
  default_service = google_compute_backend_service.web.id

  host_rule {
    hosts        = [var.domain]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.web.id

    # Admin API — IAP protected
    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.api_admin.id
    }

    # SDK endpoints — public
    path_rule {
      paths   = ["/sdk/*"]
      service = google_compute_backend_service.api_public.id
    }

    # Health + metrics — public
    path_rule {
      paths   = ["/health", "/metrics"]
      service = google_compute_backend_service.api_public.id
    }
  }
}

# ── SSL Certificate ──────────────────────────────────────────────────────

resource "google_compute_managed_ssl_certificate" "default" {
  name = "mystweaver-ssl-cert"

  managed {
    domains = [var.domain]
  }
}

# ── HTTPS Proxy + Forwarding Rule ────────────────────────────────────────

resource "google_compute_target_https_proxy" "default" {
  name             = "mystweaver-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

resource "google_compute_global_forwarding_rule" "default" {
  name                  = "mystweaver-https-rule"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.default.id
  ip_address            = google_compute_global_address.default.id
  port_range            = "443"
}

# ── HTTP → HTTPS redirect ────────────────────────────────────────────────

resource "google_compute_url_map" "http_redirect" {
  name = "mystweaver-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "mystweaver-http-redirect-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name                  = "mystweaver-http-redirect-rule"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.default.id
  port_range            = "80"
}

# ── IAP access ────────────────────────────────────────────────────────────
# IAP IAM bindings require the OAuth consent screen to be configured first.
# Set up manually in GCP Console:
#   1. APIs & Services → OAuth consent screen → configure (External type)
#   2. Security → Identity-Aware Proxy → enable on backend services
#   3. Add authorized users (e.g. pgrbryant@gmail.com)

# ── Restrict Admin UI to LB-only traffic ─────────────────────────────────
# The web service should only accept traffic from the load balancer, not
# direct requests to the *.run.app URL (which would bypass IAP).
# This is handled by setting ingress = "INTERNAL_AND_GCLB" on the Cloud Run
# service (see main.tf). The allUsers invoker binding is kept because the LB
# uses its own identity to invoke Cloud Run.
