output "cdn_origin_configs" {
  description = "Configuration to be passed to the kube_cdn module to configure the CDN"
  value       = var.cdn_mode_enabled ? local.cdn_origin_configs : []
}