output "superuser_creds_secret" {
  description = "The name of the Kubernetes Secret holding certificate credentials for the superuser role in the NATS cluster"
  value       = "${local.cluster_name}-superuser-creds"
}

output "admin_creds_secret" {
  description = "The name of the Kubernetes Secret holding certificate credentials for the admin role in the NATS cluster"
  value       = "${local.cluster_name}-admin-creds"
}

output "reader_creds_secret" {
  description = "The name of the Kubernetes Secret holding certificate credentials for the reader role in the NATS cluster"
  value       = "${local.cluster_name}-reader-creds"
}

output "client_port" {
  description = "The port that NATS clients should connect to."
  value       = 4222
}

output "cluster_port" {
  description = "The port that NATS uses for internal cluster communication."
  value       = 6222
}

output "metrics_port" {
  description = "The port that Prometheus metrics is served on."
  value       = 8222
}

output "host" {
  description = "The NATS cluster hostname to connect to,"
  value       = "${local.cluster_name}.${var.namespace}.svc.cluster.local"
}

