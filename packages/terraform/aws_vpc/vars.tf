variable "nat_associations" {
  description = "A mapping of NATed egress network traffic between subnets. Keys represent the source subnets. Values represent destination subnets that will contain the NAT resources."
  type        = map(string)
  default     = {}
}

variable "subnets" {
  description = "Subnet configuration"
  type = map(object({
    az         = string                    # Availability zone
    cidr_block = string                    # Subnet IP block
    public     = bool                      # If subnet is routable to and from the public internet
    extra_tags = optional(map(string), {}) # Additional tags for the subnet
  }))
}

variable "vpc_cidr" {
  description = "The main CIDR range for the VPC."
  type        = string
}

variable "vpc_extra_tags" {
  description = "Extra tags to add to the VPC resource."
  type        = map(string)
  default     = {}
}

variable "vpc_name" {
  description = "The name of the VPC resource."
  type        = string
}

variable "vpc_peer_acceptances" {
  description = "A list of VPC peering requests to accept. All VPC peers will be routable from all subnets."
  type = map(object({
    allow_dns                 = bool   # Whether the remote VPC can use the DNS in this VPC.
    cidr_block                = string # The CIDR block to route to the remote VPC.
    vpc_peering_connection_id = string # The peering connection ID produced from the VPC peer request.
  }))
  default = {}
}