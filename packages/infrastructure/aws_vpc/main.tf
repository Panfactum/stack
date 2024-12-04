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
  nat_subnets        = { for source, destination in var.nat_associations : destination => source }
  nat_subnet_list    = tolist(toset(keys(local.nat_subnets)))
  peering_route_list = flatten([for subnet in keys(var.subnets) : [for label, config in var.vpc_peer_acceptances : merge({ subnet = subnet, vpc = label }, config)]])
  peering_routes     = { for peer_route in local.peering_route_list : "${peer_route.subnet}_${peer_route.vpc}" => peer_route }
  public_subnets     = { for name, subnet in var.subnets : name => subnet if subnet.public }
  private_subnets    = { for name, subnet in var.subnets : name => subnet if contains(keys(var.nat_associations), name) }

  # We omit some tags that change frequently from node group
  # instances b/c changing these tags forces the nodes to roll
  # which is a disruptive and time consuming operation
  instance_tags = {
    for k, v in data.pf_aws_tags.tags.tags : k => v if !contains([
      "panfactum.com/stack-commit",
      "panfactum.com/stack-version"
    ], k)
  }
}

data "aws_region" "region" {}
data "aws_caller_identity" "current" {}

data "pf_aws_tags" "tags" {
  module = "aws_vpc"
}


##########################################################################
## Main VPC
##########################################################################
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(data.pf_aws_tags.tags.tags, var.vpc_extra_tags, { Name = var.vpc_name })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(data.pf_aws_tags.tags.tags, { Name = var.vpc_name })
}

##########################################################################
## Resource Endpoints
##########################################################################

resource "aws_vpc_endpoint" "s3" {
  vpc_id          = aws_vpc.main.id
  service_name    = "com.amazonaws.${data.aws_region.region.name}.s3"
  route_table_ids = [for table in aws_route_table.tables : table.id]
  tags            = merge(data.pf_aws_tags.tags.tags, { Name = "S3-endpoint-${aws_vpc.main.id}}" })
}

##########################################################################
## Subnets
##########################################################################

resource "aws_subnet" "subnets" {
  for_each                = var.subnets
  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr_block
  availability_zone       = lower(length(each.value.az) == 1 ? "${data.aws_region.region.name}${each.value.az}" : each.value.az) ## Allows the user to input either 'a' or 'us-east-2a'
  map_public_ip_on_launch = each.value.public
  tags = merge(data.pf_aws_tags.tags.tags, each.value.extra_tags, {
    Name                 = each.key
    "panfactum.com/type" = each.value.public ? "public" : contains(keys(var.nat_associations), each.key) ? "private" : "isolated"
  })

  lifecycle {
    ignore_changes = [tags["panfactum.com/public-ip"]]
  }
}

##########################################################################
## NATs
##
## We use the https://github.com/AndrewGuenther/fck-nat project to lower
## our egress costs. However, we heavily modify the userscript to provide
## enhanced functionality.
##
## Note this does sacrifice some high availability as outbound traffic will
## be temporarily halted when these instances restart. Additionally, our egress
## traffic limit is capped at 5 Gbs.
##########################################################################

data "aws_iam_policy_document" "nat_policy" {
  statement {
    actions = [
      "ec2:DescribeNetworkInterface*",
      "ec2:AttachNetworkInterface",
      "ec2:ModifyNetworkInterfaceAttribute",
      "ec2:AssociateAddress",
      "ec2:DisassociateAddress",
      "ec2:TerminateInstances"
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
  tags               = data.pf_aws_tags.tags.tags
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
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_eip" "nat_ips" {
  for_each = local.nat_subnets

  depends_on = [aws_internet_gateway.main]
  tags = merge(data.pf_aws_tags.tags.tags, {
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

  tags = merge(data.pf_aws_tags.tags.tags, {
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

  tags = merge(data.pf_aws_tags.tags.tags, {
    description = "Security group for NAT nodes in ${each.key}"
  })
}

data "aws_ami" "fck_nat" {
  filter {
    name   = "name"
    values = ["fck-nat-al2023-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  # This ensures the AMI won't update unless we explicitly allow it
  # as changing the AMI will force the instances to update which might cause
  # a service disruption
  filter {
    name   = "creation-date"
    values = ["2024-01-25*"]
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
    tags = merge(
      { for k, v in local.instance_tags : replace(k, "/", ":") => v }, // For some reason, "/" is now disallowed here?
      {
        Name        = "nat-${each.key}"
        description = "NAT node in ${each.key}"
      }
    )
  }
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      delete_on_termination = true
      encrypted             = true
      volume_size           = 8
      volume_type           = "gp3"
    }
  }
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = merge(data.pf_aws_tags.tags.tags, {
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

  // There is necessary as there is a race condition in the AWS backend
  // that can occasionally cause a temporary, harmless error
  // that is resolved by simply continuing to wait instead of immediately exiting
  ignore_failed_scaling_activities = true
}

##########################################################################
## ASG for Network Connectivity Tests
##########################################################################

data "aws_iam_policy_document" "test_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      identifiers = ["ec2.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "test" {
  name_prefix        = "network-test-"
  assume_role_policy = data.aws_iam_policy_document.test_assume_role_policy.json
  description        = "Role for network test instances"
  tags               = data.pf_aws_tags.tags.tags
}

resource "aws_iam_role_policy_attachment" "node_group_ssm" {
  role       = aws_iam_role.test.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "test" {
  role = aws_iam_role.test.name
  tags = data.pf_aws_tags.tags.tags
}

resource "aws_security_group" "test" {
  for_each = local.private_subnets

  name_prefix = "network-test-"
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

  tags = merge(data.pf_aws_tags.tags.tags, {
    description = "Security group for network test nodes in ${each.key}"
  })
}

data "aws_ami" "test" {
  filter {
    name   = "name"
    values = ["al2023-ami-ecs-*"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
  owners      = ["amazon"]
  most_recent = true
}

resource "aws_launch_template" "test" {
  for_each      = local.private_subnets
  name_prefix   = "network-test-"
  image_id      = data.aws_ami.test.id
  instance_type = "t4g.nano"
  iam_instance_profile {
    arn = aws_iam_instance_profile.test.arn
  }
  vpc_security_group_ids = [aws_security_group.test[each.key].id]
  tag_specifications {
    resource_type = "instance"
    tags          = { for k, v in data.pf_aws_tags.tags.tags : replace(k, "/", ":") => v } // For some reason, "/" is now disallowed here?
  }
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      delete_on_termination = true
      encrypted             = true
      volume_size           = 30
      volume_type           = "gp3"
    }
  }
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = merge(data.pf_aws_tags.tags.tags, {
    description = "Launch template for network test nodes in ${each.key}"
  })

  depends_on = [
    aws_iam_role.test
  ]
}

resource "aws_autoscaling_group" "test" {
  for_each         = local.private_subnets
  name_prefix      = "network-test-"
  max_size         = 1
  min_size         = 0
  desired_capacity = 0
  launch_template {
    name    = aws_launch_template.test[each.key].name
    version = aws_launch_template.test[each.key].latest_version
  }
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 0
    }
  }
  vpc_zone_identifier = [aws_subnet.subnets[each.key].id]

  // There is necessary as there is a race condition in the AWS backend
  // that can occasionally cause a temporary, harmless error
  // that is resolved by simply continuing to wait instead of immediately exiting
  ignore_failed_scaling_activities = true
}

##########################################################################
## Routing
##########################################################################

resource "aws_route_table" "tables" {
  for_each = var.subnets

  vpc_id = aws_vpc.main.id
  tags   = merge(data.pf_aws_tags.tags.tags, { Name = "RT_${each.key}" })
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
  tags                      = merge(data.pf_aws_tags.tags.tags, { Name = each.key })
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

data "aws_iam_policy_document" "log_delivery" {

  # https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs-s3.html
  statement {
    sid    = "AWSLogDeliveryWrite"
    effect = "Allow"
    principals {
      identifiers = ["delivery.logs.amazonaws.com"]
      type        = "Service"
    }
    actions   = ["s3:PutObject"]
    resources = ["${module.log_bucket.bucket_arn}/*"]
    condition {
      test     = "StringEquals"
      values   = [data.aws_caller_identity.current.account_id]
      variable = "aws:SourceAccount"
    }
    condition {
      test     = "StringEquals"
      values   = ["bucket-owner-full-control"]
      variable = "s3:x-amz-acl"
    }
    condition {
      test     = "ArnLike"
      values   = ["arn:aws:logs:${data.aws_region.region.name}:${data.aws_caller_identity.current.account_id}:*"]
      variable = "aws:SourceArn"
    }
  }

  statement {
    sid    = "AWSLogDeliveryAclCheck"
    effect = "Allow"
    principals {
      identifiers = ["delivery.logs.amazonaws.com"]
      type        = "Service"
    }
    actions = [
      "s3:GetBucketAcl",
      "s3:ListBucket"
    ]
    resources = [module.log_bucket.bucket_arn]
    condition {
      test     = "StringEquals"
      values   = [data.aws_caller_identity.current.account_id]
      variable = "aws:SourceAccount"
    }
    condition {
      test     = "ArnLike"
      values   = ["arn:aws:logs:${data.aws_region.region.name}:${data.aws_caller_identity.current.account_id}:*"]
      variable = "aws:SourceArn"
    }
  }
}

module "log_bucket" {
  source      = "../aws_s3_private_bucket"
  bucket_name = "flow-logs-${aws_vpc.main.id}"
  description = "Flow logs for the ${var.vpc_name} VPC"

  expire_after_days               = var.vpc_flow_logs_expire_after_days
  timed_transitions_enabled       = true
  intelligent_transitions_enabled = false

  access_policy = data.aws_iam_policy_document.log_delivery.json
}

moved {
  from = aws_flow_log.flow_logs
  to   = aws_flow_log.flow_logs[0]
}

resource "aws_flow_log" "flow_logs" {
  count = var.vpc_flow_logs_enabled ? 1 : 0

  destination_options {
    file_format        = "plain-text"
    per_hour_partition = true
  }

  log_destination          = module.log_bucket.bucket_arn
  log_destination_type     = "s3"
  max_aggregation_interval = 600
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  tags                     = data.pf_aws_tags.tags.tags
}
