output "arn" {
  description = "The ARN of the KMS key"
  value       = aws_kms_key.key.arn
}

output "arn2" {
  description = "The ARN of the backup key"
  value       = replace(aws_kms_key.key.arn, data.aws_region.primary.name, data.aws_region.secondary.name)
}

output "alias_arn" {
  value = aws_kms_alias.alias.arn
}

output "id" {
  value = aws_kms_key.key.id
}