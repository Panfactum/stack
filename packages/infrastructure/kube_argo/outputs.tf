output "argo_urls" {
  value = [for domain in local.argo_domains : "https://${domain}"]
}