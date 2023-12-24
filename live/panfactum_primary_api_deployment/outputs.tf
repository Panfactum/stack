output "public_url" {
  value = "https://${var.ingress_domains[0]}${var.ingress_path_prefix}"
}
