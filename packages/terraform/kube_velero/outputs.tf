output "backup_bucket" {
  description = "The name of the S3 bucket used to store cluster backups"
  value       = module.backup_bucket.bucket_name
}

output "backup_bucket_arn" {
  description = "The ARN of the S3 bucket used to store cluster backups"
  value       = module.backup_bucket.bucket_arn
}