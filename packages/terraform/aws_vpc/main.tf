// Live

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {
  nat_subnets        = { for source, destination in var.nat_associations : destination => source }
  nat_subnet_list    = tolist(toset(keys(local.nat_subnets)))
  peering_route_list = flatten([for subnet in keys(var.subnets) : [for label, config in var.vpc_peer_acceptances : merge({ subnet = subnet, vpc = label }, config)]])
  peering_routes     = { for peer_route in local.peering_route_list : "${peer_route.subnet}_${peer_route.vpc}" => peer_route }
  public_subnets     = { for name, subnet in var.subnets : name => subnet if subnet.public }
}

data "aws_region" "region" {}

module "tags" {
  source         = "../aws_tags"
  environment    = var.environment
  region         = var.region
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  extra_tags     = var.extra_tags
  is_local       = var.is_local
}

##########################################################################
## Main VPC
##########################################################################
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(module.tags.tags, var.vpc_extra_tags, { Name = var.vpc_name })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(module.tags.tags, { Name = var.vpc_name })
}

##########################################################################
## Resource Endpoints
##########################################################################

resource "aws_vpc_endpoint" "s3" {
  vpc_id          = aws_vpc.main.id
  service_name    = "com.amazonaws.${data.aws_region.region.name}.s3"
  route_table_ids = [for table in aws_route_table.tables : table.id]
  tags            = merge(module.tags.tags, { Name = "S3-endpoint-${aws_vpc.main.id}}" })
}

##########################################################################
## Subnets
##########################################################################

resource "aws_subnet" "subnets" {
  for_each                = var.subnets
  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr_block
  availability_zone       = each.value.az
  map_public_ip_on_launch = each.value.public
  tags = merge(module.tags.tags, each.value.extra_tags, {
    Name                 = each.key
    "panfactum.com/type" = each.value.public ? "public" : contains(keys(var.nat_associations), each.key) ? "private" : "isolated"
  })
}

##########################################################################
## NATs
##
## We use the https://github.com/AndrewGuenther/fck-nat project to lower
## our egress costs.
##
## Note this does sacrifice some high availability as outbound traffic will
## be temporarily halted when these instances restart. Additionally, our egress
## traffic limit is capped at 5 Gbs.
##########################################################################

data "aws_iam_policy_document" "nat_policy" {
  statement {
    actions = [
      "ec2:AttachNetworkInterface",
      "ec2:ModifyNetworkInterfaceAttribute",
      "ec2:AssociateAddress",
      "ec2:DisassociateAddress"
    ]
    effect    = "Allow"
    resources = ["*"]
  }
}

data "aws_iam_policy_document" "nat_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      identifiers = ["ec2.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "nat" {
  name_prefix        = "fck-nat-"
  assume_role_policy = data.aws_iam_policy_document.nat_assume_role_policy.json
  description        = "Role for fck-nat (self-hosted NAT) instances"
  tags               = module.tags.tags
}

resource "aws_iam_policy" "nat" {
  name_prefix = "fck-nat-"
  policy      = data.aws_iam_policy_document.nat_policy.json
  description = "Policy for fck-nat (self-hosted NAT) instances"
}

resource "aws_iam_role_policy_attachment" "nat" {
  policy_arn = aws_iam_policy.nat.arn
  role       = aws_iam_role.nat.name
}

resource "aws_iam_instance_profile" "nat" {
  role = aws_iam_role.nat.name
  tags = module.tags.tags
}

resource "aws_eip" "nat_ips" {
  for_each = local.nat_subnets

  depends_on = [aws_internet_gateway.main]
  tags = merge(module.tags.tags, {
    Name                   = "NAT_${each.key}"
    "panfactum.com/for"    = each.value
    "panfactum.com/vpc-id" = aws_vpc.main.id
  })
}

resource "aws_ec2_tag" "eip_subnet_tags" {
  for_each    = local.nat_subnets
  resource_id = aws_subnet.subnets[each.value].id
  key         = "panfactum.com/public-ip"
  value       = aws_eip.nat_ips[each.key].public_ip
}

resource "aws_network_interface" "nats" {
  for_each = local.nat_subnets

  subnet_id         = aws_subnet.subnets[each.key].id
  source_dest_check = false
  security_groups   = [aws_security_group.nats[each.key].id]

  tags = merge(module.tags.tags, {
    Name = each.key
  })
}

resource "aws_security_group" "nats" {
  for_each = local.nat_subnets

  name_prefix = "nat-"
  vpc_id      = aws_vpc.main.id
  ingress {
    description = "Only allow inbound traffic from inside the VPC"
    cidr_blocks = [var.vpc_cidr]
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
  }
  egress {
    description = "Allow outbound traffic"
    cidr_blocks = ["0.0.0.0/0"]
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
  }

  tags = merge(module.tags.tags, {
    description = "Security group for NAT nodes in ${each.key}"
  })
}

data "aws_ami" "fck_nat" {
  filter {
    name   = "name"
    values = ["fck-nat-amzn2-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
  owners      = ["568608671756"]
  most_recent = true
}

resource "aws_launch_template" "nats" {
  for_each      = local.nat_subnets
  name_prefix   = "nat-"
  image_id      = data.aws_ami.fck_nat.id
  instance_type = "t4g.nano"
  iam_instance_profile {
    arn = aws_iam_instance_profile.nat.arn
  }
  vpc_security_group_ids = [aws_security_group.nats[each.key].id]
  user_data = base64encode(templatefile("nat_user_data.sh", {
    ENI_ID            = aws_network_interface.nats[each.key].id
    EIP_ALLOCATION_ID = aws_eip.nat_ips[each.key].allocation_id
  }))
  tag_specifications {
    resource_type = "instance"
    tags = merge(module.tags.tags, {
      Name        = "nat-${each.key}"
      description = "NAT node in ${each.key}"
    })
  }

  tags = merge(module.tags.tags, {
    description = "Launch template for NAT nodes in ${each.key}"
  })

  depends_on = [
    aws_iam_role.nat
  ]
}

resource "aws_autoscaling_group" "nats" {
  for_each         = local.nat_subnets
  name_prefix      = "nat-"
  max_size         = 1
  min_size         = 1
  desired_capacity = 1
  launch_template {
    name    = aws_launch_template.nats[each.key].name
    version = aws_launch_template.nats[each.key].latest_version
  }
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 0
    }
  }
  vpc_zone_identifier = [aws_subnet.subnets[each.key].id]
}

##########################################################################
## Routing
##########################################################################

resource "aws_route_table" "tables" {
  for_each = var.subnets

  vpc_id = aws_vpc.main.id
  tags   = merge(module.tags.tags, { Name = "RT_${each.key}" })
}

resource "aws_route" "igw" {
  for_each = local.public_subnets

  route_table_id         = aws_route_table.tables[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route" "vpc_peers" {
  for_each = local.peering_routes

  route_table_id            = aws_route_table.tables[each.value.subnet].id
  destination_cidr_block    = each.value.cidr_block
  vpc_peering_connection_id = each.value.vpc_peering_connection_id
}

resource "aws_route" "nats" {
  for_each = var.nat_associations

  route_table_id         = aws_route_table.tables[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_network_interface.nats[each.value].id
}

resource "aws_route_table_association" "associations" {
  for_each = var.subnets

  subnet_id      = aws_subnet.subnets[each.key].id
  route_table_id = aws_route_table.tables[each.key].id
}

##########################################################################
## VPC Peering
##########################################################################

resource "aws_vpc_peering_connection_accepter" "accepters" {
  for_each = var.vpc_peer_acceptances

  vpc_peering_connection_id = each.value.vpc_peering_connection_id
  auto_accept               = true
  tags                      = merge(module.tags.tags, { Name = each.key })
}

resource "aws_vpc_peering_connection_options" "accepters" {
  for_each = var.vpc_peer_acceptances

  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.accepters[each.key].vpc_peering_connection_id
  accepter {
    allow_remote_vpc_dns_resolution = each.value.allow_dns
  }
}

##########################################################################
## Flow Logs
##########################################################################

#resource "aws_s3_bucket" "flow_logs" {
#  for_each = var.subnets
#
#  bucket_prefix       = lower(replace(each.key, "_", "-"))
#  object_lock_enabled = true
#}
#
#resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
#  for_each = var.subnets
#
#  bucket = aws_s3_bucket.flow_logs[each.key].bucket
#
#  rule {
#    bucket_key_enabled = true
#
#    apply_server_side_encryption_by_default {
#      sse_algorithm = "aws:kms"
#    }
#  }
#}
#
#resource "aws_s3_bucket_metric" "flow_logs" {
#  for_each = var.subnets
#
#  bucket = aws_s3_bucket.flow_logs[each.key].bucket
#  name   = "EntireBucket"
#}
#
#resource "aws_s3_bucket_policy" "log_delivery" {
#  for_each = var.subnets
#
#  bucket = aws_s3_bucket.flow_logs[each.key].bucket
#  policy = data.aws_iam_policy_document.log_delivery[each.key].json
#}
#
#resource "aws_s3_bucket_public_access_block" "flow_logs" {
#  for_each = var.subnets
#
#  bucket                  = aws_s3_bucket.flow_logs[each.key].bucket
#  block_public_acls       = true
#  block_public_policy     = true
#  ignore_public_acls      = true
#  restrict_public_buckets = true
#}
#
#data "aws_iam_policy_document" "log_delivery" {
#  for_each = var.subnets
#
#  # https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-s3.html#flow-logs-s3-permissions
#  statement {
#    actions = ["s3:PutObject"]
#    condition {
#      test     = "ArnLike"
#      values   = ["arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"]
#      variable = "aws:SourceArn"
#    }
#    condition {
#      test     = "StringEquals"
#      values   = [var.aws_account_id]
#      variable = "aws:SourceAccount"
#    }
#    condition {
#      test     = "StringEquals"
#      values   = ["bucket-owner-full-control"]
#      variable = "s3:x-amz-acl"
#    }
#    effect = "Allow"
#    principals {
#      identifiers = ["delivery.logs.amazonaws.com"]
#      type        = "Service"
#    }
#    resources = ["${aws_s3_bucket.flow_logs[each.key].arn}/AWSLogs/${var.aws_account_id}/*"]
#    sid       = "AWSLogDeliveryWrite"
#  }
#
#  statement {
#    actions = ["s3:GetBucketAcl"]
#    condition {
#      test     = "ArnLike"
#      values   = ["arn:aws:logs:${var.aws_region}:${var.aws_account_id}:*"]
#      variable = "aws:SourceArn"
#    }
#    condition {
#      test     = "StringEquals"
#      values   = [var.aws_account_id]
#      variable = "aws:SourceAccount"
#    }
#    effect = "Allow"
#    principals {
#      identifiers = ["delivery.logs.amazonaws.com"]
#      type        = "Service"
#    }
#    resources = [aws_s3_bucket.flow_logs[each.key].arn]
#    sid       = "AWSLogDeliveryAclCheck"
#  }
#
#  version = "2012-10-17"
#}
#
#resource "aws_s3_bucket_intelligent_tiering_configuration" "flow_log_archive" {
#  for_each = var.subnets
#
#  bucket = aws_s3_bucket.flow_logs[each.key].bucket
#  name   = "archive"
#  status = "Enabled"
#
#  tiering {
#    access_tier = "ARCHIVE_ACCESS"
#    days        = 90
#  }
#  tiering {
#    access_tier = "DEEP_ARCHIVE_ACCESS"
#    days        = 180
#  }
#}
#
#resource "aws_flow_log" "flow_logs" {
#  for_each = var.subnets
#
#  destination_options {
#    file_format        = "plain-text"
#    per_hour_partition = true
#  }
#
#  log_destination          = aws_s3_bucket.flow_logs[each.key].arn
#  log_destination_type     = "s3"
#  max_aggregation_interval = 600
#  subnet_id                = aws_subnet.subnets[each.key].id
#  traffic_type             = "ALL"
#  tags                     = { Name = "FL_${each.key}" }
#}
#
#resource "aws_s3_bucket_object_lock_configuration" "locks" {
#  for_each = var.subnets
#
#  bucket              = aws_s3_bucket.flow_logs[each.key].bucket
#  object_lock_enabled = "Enabled"
#
#  rule {
#    default_retention {
#      mode  = "GOVERNANCE"
#      years = 10
#    }
#  }
#}
