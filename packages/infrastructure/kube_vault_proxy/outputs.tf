output "upstream_ingress_annotations" {
  description = "Annotations to add to the upstream ingress"
  value = {
    "nginx.ingress.kubernetes.io/auth-url"    = "https://$host${local.proxy_path}/auth"
    "nginx.ingress.kubernetes.io/auth-signin" = "https://$host${local.proxy_path}/start?rd=$escaped_request_uri"
  }
}
