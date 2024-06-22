output "namespace" {
  value = local.namespace
}

output "github_webhook_secret" {
  description = "The webhook token to set in GitHub"
  sensitive = true
  value = random_password.webhook_token.result
}