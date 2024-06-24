output "cache_bucket_name" {
  value = module.cache_bucket.bucket_name
}

output "cache_bucket_region" {
  value = data.aws_region.region.name
}
