output "distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = module.cdn.distribution_id
}

output "logging_bucket_name" {
  description = "The name of the log bucket for CloudFront access logs"
  value       = module.cdn.logging_bucket_name
}