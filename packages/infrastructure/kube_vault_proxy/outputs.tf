output "upstream_ingress_annotations" {
  description = "Annotations to add to the upstream ingress"
  value = {
    "nginx.ingress.kubernetes.io/auth-url"    = "https://$host${local.path_prefix}/auth"
    "nginx.ingress.kubernetes.io/auth-signin" = "https://$host${local.path_prefix}/start?rd=$escaped_request_uri"
  }
}