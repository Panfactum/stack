output "sentinel_host" {
  description = "A service address that points to the redis sentinel"
  value       = module.redis.redis_sentinel_host
}

output "sentinel_port" {
  description = "The port that the redis sentinel is listening on"
  value       = module.redis.redis_sentinel_port
}

output "admin_creds_secret" {
  description = "The name of the secret that contains the superuser credentials"
  value       = module.redis.admin_creds_secret
}

output "admin_role" {
  description = "The Vault role used to get admin credentials for the created Redis cluster"
  value       = module.redis.admin_role
}

output "testing" {
  description = "The value for the master set to use when configuring Sentinel-aware Redis clients"
  value       = "tesitng"
}

output "master_set" {
  description = "The value for the master set to use when configuring Sentinel-aware Redis clients"
  value       = module.redis.master_set
}