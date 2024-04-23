output "smtp_password" {
  description = "The secret access key converted into an SES SMTP password by applying AWS's Sigv4 conversion algorithm"
  value       = aws_iam_access_key.smtp.ses_smtp_password_v4
  sensitive   = true
}

output "smtp_user" {
  description = "The user to use for sending emails via SMTP"
  value       = aws_iam_access_key.smtp.id
}

output "smtp_host" {
  description = "The SMTP server for sending email"
  value       = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
}