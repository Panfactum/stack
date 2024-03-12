# AWS Virtual Private Cloud (VPC)

**Type:** Live

This module configures the following infrastructure resources for a Virtual Private Cloud:

- Establishes a [VPC](https://aws.amazon.com/vpc/)
- Deploys [subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html) with associated [CIDR reservations](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-cidr-reservation.html) and [Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)
- [NAT](https://en.wikipedia.org/wiki/Network_address_translation) instances static [Elastic IP](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-eips.html)
  addresses associated and mapped correctly.
- An [internet gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) to allow resources that get public IPs in the VPC to be accessible from the internet.
- [VPC peering](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-peering.html) as required with resources outside the VPC.
- Full [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html) with appropriate retention and tiering for compliance and cost management.
- An [S3 Gateway endpoint](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html) for free network
  traffic to/from AWS S3