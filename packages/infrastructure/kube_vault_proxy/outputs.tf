output "upstream_ingress_annotations" {
  description = "Annotations to add to the upstream ingress"
  value = {
    "nginx.ingress.kubernetes.io/auth-url"    = "https://$host/oauth2/auth"
    "nginx.ingress.kubernetes.io/auth-signin" = "https://$host/oauth2/start?rd=$escaped_request_uri"
  }
}