output "role_arn" {
  description = "The ARN of the IAM role used to manage DNS records."
  value       = aws_iam_role.record_manager.arn
}