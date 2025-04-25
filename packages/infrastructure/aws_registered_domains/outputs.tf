output "domains" {
  value     = aws_route53domains_registered_domain.domain
  sensitive = true
}

output "record_manager_role_arn" {
  description = "The ARN of the IAM role used to manage DNS records."
  value       = module.iam_role.role_arn
}

output "zones" {
  description = "Zone information"
  value       = { for zone in aws_route53_zone.zones : zone.name => { zone_id : zone.zone_id } }
}
