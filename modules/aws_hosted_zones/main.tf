terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.10"
    }
  }
}

locals {
  mx_records  = flatten([for zone, config in var.zones : [for record in config.mx_records : { zone : zone, record : record }]])
  txt_records = flatten([for zone, config in var.zones : [for record in config.txt_records : { zone : zone, record : record }]])
  ns_records  = flatten([for zone, config in var.zones : [for record in config.ns_records : { zone : zone, record : record }]])
}

##########################################################################
## Zone Setup
##########################################################################

resource "aws_route53_delegation_set" "zones" {
  for_each = var.zones
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_zone" "zones" {
  for_each          = var.zones
  name              = each.key
  delegation_set_id = aws_route53_delegation_set.zones[each.key].id
}

##########################################################################
## Record Setup
##########################################################################

resource "aws_route53_record" "mx" {
  count           = length(local.mx_records)
  type            = "MX"
  zone_id         = aws_route53_zone.zones[local.mx_records[count.index].zone].zone_id
  name            = "${local.mx_records[count.index].record.subdomain}${local.mx_records[count.index].zone}"
  records         = local.mx_records[count.index].record.records
  ttl             = local.mx_records[count.index].record.ttl
  allow_overwrite = true
}

resource "aws_route53_record" "txt" {
  count   = length(local.txt_records)
  type    = "TXT"
  zone_id = aws_route53_zone.zones[local.txt_records[count.index].zone].zone_id
  name    = "${local.txt_records[count.index].record.subdomain}${local.txt_records[count.index].zone}"
  // Need to do a bit of cleaning based on record length due to AWS API limitations
  records         = [for record in local.txt_records[count.index].record.records : length(record) > 255 ? "${substr(record, 0, 255)}\"\"${substr(record, 255, length(record))}" : record]
  ttl             = local.txt_records[count.index].record.ttl
  allow_overwrite = true
}

resource "aws_route53_record" "ns" {
  count           = length(local.ns_records)
  type            = "NS"
  zone_id         = aws_route53_zone.zones[local.ns_records[count.index].zone].zone_id
  name            = "${local.ns_records[count.index].record.subdomain}${local.ns_records[count.index].zone}"
  records         = local.ns_records[count.index].record.records
  ttl             = local.ns_records[count.index].record.ttl
  allow_overwrite = true
}
