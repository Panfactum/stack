output "certificate_name" {
  value = kubernetes_manifest.webhook_cert.manifest.metadata.name
}

output "secret_name" {
  value = kubernetes_manifest.webhook_cert.manifest.spec.secretName
}