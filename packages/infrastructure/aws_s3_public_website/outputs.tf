output "bucket_arn" {
  value = module.bucket.bucket_arn
}

output "bucket_name" {
  value = module.bucket.bucket_name
}

output "domain" {
  value = module.bucket.regional_domain_name
}
