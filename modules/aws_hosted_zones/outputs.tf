output "zones" {
  value = { for k, v in var.zones : k => {
    delegation_set = aws_route53_delegation_set.zones[k].name_servers
    zone_id        = aws_route53_zone.zones[k].zone_id
  } }
}
