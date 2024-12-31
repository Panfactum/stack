output "creds_secret" {
  description = "The name of the Kubernetes Secret holding credentials for the IAM user"
  value       = "${random_id.user.hex}-creds"
}