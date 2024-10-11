// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
  }
}

locals {
  cname_records = flatten([for zone, config in var.zones : [for record in config.cname_records : { zone : zone, record : record }]])
  mx_records    = flatten([for zone, config in var.zones : [for record in config.mx_records : { zone : zone, record : record }]])
  txt_records   = flatten([for zone, config in var.zones : [for record in config.txt_records : { zone : zone, record : record }]])
  a_records     = flatten([for zone, config in var.zones : [for record in config.a_records : { zone : zone, record : record }]])
}

##########################################################################
## Record Setup
##########################################################################

data "aws_route53_zone" "zones" {
  for_each = var.zones
  name     = each.key
}

resource "aws_route53_record" "a" {
  count           = length(local.a_records)
  type            = "A"
  zone_id         = data.aws_route53_zone.zones[local.a_records[count.index].zone].zone_id
  name            = "${local.a_records[count.index].record.subdomain}${local.a_records[count.index].zone}"
  records         = local.a_records[count.index].record.records
  ttl             = local.a_records[count.index].record.ttl
  allow_overwrite = true
}

resource "aws_route53_record" "mx" {
  count           = length(local.mx_records)
  type            = "MX"
  zone_id         = data.aws_route53_zone.zones[local.mx_records[count.index].zone].zone_id
  name            = "${local.mx_records[count.index].record.subdomain}${local.mx_records[count.index].zone}"
  records         = local.mx_records[count.index].record.records
  ttl             = local.mx_records[count.index].record.ttl
  allow_overwrite = true
}

resource "aws_route53_record" "cname" {
  count           = length(local.cname_records)
  type            = "CNAME"
  zone_id         = data.aws_route53_zone.zones[local.cname_records[count.index].zone].zone_id
  name            = "${local.cname_records[count.index].record.subdomain}${local.cname_records[count.index].zone}"
  records         = [local.cname_records[count.index].record.record]
  ttl             = local.cname_records[count.index].record.ttl
  allow_overwrite = true
}

resource "aws_route53_record" "txt" {
  count   = length(local.txt_records)
  type    = "TXT"
  zone_id = data.aws_route53_zone.zones[local.txt_records[count.index].zone].zone_id
  name    = "${local.txt_records[count.index].record.subdomain}${local.txt_records[count.index].zone}"
  // Need to do a bit of cleaning based on record length due to AWS API limitations
  records         = [for record in local.txt_records[count.index].record.records : length(record) > 255 ? "${substr(record, 0, 255)}\"\"${substr(record, 255, length(record))}" : record]
  ttl             = local.txt_records[count.index].record.ttl
  allow_overwrite = true
}
