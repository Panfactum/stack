output "dns_zones" {
  value = { for domain in var.dns_zones : domain => {
    record_manager_role_arn = aws_iam_role.record_manager.arn
    zone_id                 = data.aws_route53_zone.zones[domain].zone_id
  } }
}