output "bucket_name" {
  description = "The name of the S3 bucket to use as an Airbyte destination"
  value       = module.s3_bucket.bucket_name
}

output "bucket_region" {
  description = "The region of the S3 bucket"
  value       = data.aws_region.current.name
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = module.s3_bucket.bucket_arn
}