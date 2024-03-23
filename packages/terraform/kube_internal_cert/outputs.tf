output "certificate_name" {
  value = kubernetes_manifest.cert.manifest.metadata.name
}

output "secret_name" {
  value = kubernetes_manifest.cert.manifest.spec.secretName
}