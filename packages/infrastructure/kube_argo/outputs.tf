output "artifact_bucket_arn" {
  description = "ARN of the S3 bucket holding workflow artifacts"
  value       = module.artifact_bucket.bucket_arn
}

output "artifact_bucket_name" {
  description = "Name of the S3 bucket holding workflow artifacts"
  value       = module.artifact_bucket.bucket_name
}

output "db_backup_bucket" {
  description = "The name of the S3 bucket that contains the PostgreSQL backups and WAL archives"
  value       = module.database.backup_bucket_name
}

output "db_backup_directory" {
  description = "The name of the directory in the backup bucket that contains the PostgreSQL backups and WAL archives"
  value       = module.database.backup_directory
}