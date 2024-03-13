output "record_manager_role_arn" {
  description = "The ARN of the IAM role used to manage DNS records."
  value       = module.iam_role.role_arn
}
