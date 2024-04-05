output "db_admin_role" {
  value = module.database.db_admin_role
}

output "db_writer_role" {
  value = module.database.db_writer_role
}

output "db_reader_role" {
  value = module.database.db_reader_role
}

output "db_superuser_username" {
  value = module.database.superuser_username
}

output "db_superuser_password" {
  value     = module.database.superuser_password
  sensitive = true
}

output "redis_admin_role" {
  value = module.redis.admin_role
}

output "redis_writer_role" {
  value = module.redis.writer_role
}

output "redis_reader_role" {
  value = module.redis.reader_role
}
