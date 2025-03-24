output "master_host" {
  description = "A service address that points to the writable Redis master"
  value       = module.redis.redis_master_host
}

output "host" {
  description = "The host of the Redis cache"
  value       = module.redis.redis_host
}

output "port" {
  description = "The port of the Redis cache"
  value       = module.redis.redis_port
}

output "sentinel_host" {
  description = "A service address that points to the redis sentinel"
  value       = module.redis.redis_sentinel_host
}

output "sentinel_port" {
  description = "The port that the redis sentinel is listening on"
  value       = module.redis.redis_sentinel_port
}

output "admin_creds_secret" {
  description = "The name of the secret that contains the admin credentials"
  value       = module.redis.admin_creds_secret
}

output "superuser_creds_secret" {
  description = "The name of the secret that contains the superuser credentials"
  value       = module.redis.superuser_creds_secret
}

output "admin_role" {
  description = "The Vault role used to get admin credentials for the created Redis cluster"
  value       = module.redis.admin_role
}

output "master_set" {
  description = "The value for the master set to use when configuring Sentinel-aware Redis clients"
  value       = module.redis.master_set
}

output "root_name" {
  description = "The name of the root user"
  value       = module.redis.root_name
}

output "root_password" {
  description = "The password of the root user"
  value       = module.redis.root_password
  sensitive = true
}