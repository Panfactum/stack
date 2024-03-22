output "domains" {
  value = { for k in var.domain_names : k => {
    abuse_contact_email = aws_route53domains_registered_domain.domain[k].abuse_contact_email
    abuse_contact_phone = aws_route53domains_registered_domain.domain[k].abuse_contact_phone
    creation_date       = aws_route53domains_registered_domain.domain[k].creation_date
    expiration_date     = aws_route53domains_registered_domain.domain[k].expiration_date
    whois_server        = aws_route53domains_registered_domain.domain[k].whois_server
    registrar_name      = aws_route53domains_registered_domain.domain[k].registrar_name
    registrar_url       = aws_route53domains_registered_domain.domain[k].registrar_url
    reseller            = aws_route53domains_registered_domain.domain[k].reseller
    status_list         = aws_route53domains_registered_domain.domain[k].status_list
  } }
}

output "record_manager_role_arn" {
  description = "The ARN of the IAM role used to manage DNS records."
  value       = module.iam_role.role_arn
}

output "zones" {
  description = "Zone information"
  value       = { for zone in aws_route53_zone.zones : zone.name => { zone_id : zone.zone_id } }
}
