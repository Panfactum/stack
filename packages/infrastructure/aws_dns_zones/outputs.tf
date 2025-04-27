output "record_manager_role_arn" {
  description = "The ARN of the IAM role used to manage DNS records."
  value       = module.iam_role.role_arn
}

output "zones" {
  description = "Zone information"
  value = { for domain, config in var.domains : domain => {
    zone_id : aws_route53_zone.zones[domain].id,
    name_servers : aws_route53_delegation_set.zones[domain].name_servers
    ds_record : length(keys(local.dnssec_zones)) > 0 ? lookup(module.dnssec[0].keys, domain, { ds_record = null }).ds_record : null
  } }
}
