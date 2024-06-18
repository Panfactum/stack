output "artifact_bucket_arn" {
  description = "ARN of the S3 bucket holding workflow artifacts"
  value       = module.artifact_bucket.bucket_arn
}

output "artifact_bucket_name" {
  description = "Name of the S3 bucket holding workflow artifacts"
  value       = module.artifact_bucket.bucket_name
}
