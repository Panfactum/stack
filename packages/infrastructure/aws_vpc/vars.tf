variable "nat_associations" {
  description = "A mapping of NATed egress network traffic between subnets. Keys represent the source subnets. Values represent destination subnets that will contain the NAT resources."
  type        = map(string)
  default     = {}
}

variable "subnets" {
  description = "Subnet configuration"
  type = map(object({
    az         = string                    # Availability zone (either of the format 'a' or 'us-east-2a')
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

variable "vpc_flow_logs_expire_after_days" {
  description = "How many days until VPC flow logs expire."
  type        = number
  default     = 30

  validation {
    condition     = var.vpc_flow_logs_expire_after_days >= 7
    error_message = "Flow logs must be kept for at least 7 days"
  }
}

variable "vpc_flow_logs_enabled" {
  description = "Whether to enable VPC flow logs"
  type        = bool
  default     = false
}
