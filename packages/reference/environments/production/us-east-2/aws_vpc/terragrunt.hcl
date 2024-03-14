include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//aws_vpc"
}

inputs = {
  vpc_name        = "PRODUCTION_PRIMARY"
  vpc_cidr        = "10.0.0.0/16"
  vpc_description = "VPC for the primary production environment."

  nat_associations = {
    "PRIVATE_A"      = "PUBLIC_A"
    "PRIVATE_B"      = "PUBLIC_B"
    "PRIVATE_C"      = "PUBLIC_C"
  }

  subnets = {
    "PUBLIC_A" = {
      az          = "us-east-2a"
      cidr_block  = "10.0.0.0/24"
      public      = true
      description = "Subnet for incoming public traffic to availability zone A"
    },
    "PUBLIC_B" = {
      az          = "us-east-2b"
      cidr_block  = "10.0.1.0/24"
      public      = true
      description = "Subnet for incoming public traffic to availability zone B"
    },
    "PUBLIC_C" = {
      az          = "us-east-2c"
      cidr_block  = "10.0.2.0/24"
      public      = true
      description = "Subnet for incoming public traffic to availability zone C"
    },
    "PRIVATE_A" = {
      az          = "us-east-2a"
      cidr_block  = "10.0.64.0/18"
      public      = false
      description = "Subnet for private nodes in availability zone A"
    },
    "PRIVATE_B" = {
      az          = "us-east-2b"
      cidr_block  = "10.0.128.0/18"
      public      = false
      description = "Subnet for private nodes in availability zone B"
    },
    "PRIVATE_C" = {
      az          = "us-east-2c"
      cidr_block  = "10.0.192.0/18"
      public      = false
      description = "Subnet for private nodes in availability zone C"
    },
    "ISOLATED_A" = {
      az          = "us-east-2a"
      cidr_block  = "10.0.16.0/20"
      public      = false
      description = "Subnet for node isolated from public internet in availability zone A"
    }
    "ISOLATED_B" = {
      az          = "us-east-2b"
      cidr_block  = "10.0.32.0/20"
      public      = false
      description = "Subnet for node isolated from public internet in availability zone B"
    }
    "ISOLATED_C" = {
      az          = "us-east-2c"
      cidr_block  = "10.0.48.0/20"
      public      = false
      description = "Subnet for node isolated from public internet in availability zone C"
    }
  }
}
