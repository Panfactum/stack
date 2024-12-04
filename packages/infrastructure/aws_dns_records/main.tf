// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  cname_records = { for config in flatten([for zone, config in var.zones : [for record in config.cname_records : {
    type    = "CNAME"
    zone_id = data.aws_route53_zone.zones[zone].zone_id,
    name    = "${(endswith(record.subdomain, ".") || record.subdomain == "") ? record.subdomain : "${record.subdomain}."}${zone}",
    records = [record.record]
    ttl     = record.ttl
  }]]) : "${config.zone_id}-CNAME-${config.name}" => config }

  mx_records = { for config in flatten([for zone, config in var.zones : [for record in config.mx_records : {
    type    = "MX"
    zone_id = data.aws_route53_zone.zones[zone].zone_id,
    name    = "${(endswith(record.subdomain, ".") || record.subdomain == "") ? record.subdomain : "${record.subdomain}."}${zone}",
    records = record.records
    ttl     = record.ttl
  }]]) : "${config.zone_id}-MX-${config.name}" => config }

  txt_records = { for config in flatten([for zone, config in var.zones : [for record in config.txt_records : {
    type    = "TXT"
    zone_id = data.aws_route53_zone.zones[zone].zone_id,
    name    = "${(endswith(record.subdomain, ".") || record.subdomain == "") ? record.subdomain : "${record.subdomain}."}${zone}",
    records = [for record in record.records : length(record) > 255 ? "${substr(record, 0, 255)}\"\"${substr(record, 255, length(record))}" : record] // Need to do a bit of cleaning based on record length due to AWS API limitations
    ttl     = record.ttl
  }]]) : "${config.zone_id}-TXT-${config.name}" => config }

  a_records = { for config in flatten([for zone, config in var.zones : [for record in config.a_records : {
    type    = "A"
    zone_id = data.aws_route53_zone.zones[zone].zone_id,
    name    = "${(endswith(record.subdomain, ".") || record.subdomain == "") ? record.subdomain : "${record.subdomain}."}${zone}",
    records = record.records
    ttl     = record.ttl
  }]]) : "${config.zone_id}-A-${config.name}" => config }

  records = merge(
    local.cname_records,
    local.mx_records,
    local.txt_records,
    local.a_records
  )
}

##########################################################################
## Record Setup
##########################################################################

data "aws_route53_zone" "zones" {
  for_each = var.zones
  name     = each.key
}

resource "aws_route53_record" "records" {
  for_each        = local.records
  type            = each.value.type
  zone_id         = each.value.zone_id
  name            = each.value.name
  records         = each.value.records
  ttl             = each.value.ttl
  allow_overwrite = true
}
