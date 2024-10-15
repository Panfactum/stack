output "spot_data_feed_bucket" {
  description = "The name of the bucket for the spot data feed"
  value       = module.data_feed_bucket.bucket_name
}

output "spot_data_feed_bucket_arn" {
  description = "The ARN of the bucket for the spot data feed"
  value       = module.data_feed_bucket.bucket_arn
}

output "spot_data_feed_bucket_region" {
  description = "The region of the bucket for the spot data feed"
  value       = data.aws_region.current.name
}