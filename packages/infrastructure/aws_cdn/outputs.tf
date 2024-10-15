output "distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.id
}

output "logging_bucket_name" {
  description = "The name of the log bucket for CloudFront access logs"
  value       = var.logging_enabled ? module.log_bucket[0].bucket_name : null
}