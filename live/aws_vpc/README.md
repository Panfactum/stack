# Virtual Private Cloud (VPC)

This module configures the following infrastructure resources for a Virtual Private Cloud:

- Sets up the [VPC](https://aws.amazon.com/vpc/) itself in the provided AWS Account and Region.
- [Subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html) with associated [CIDR reservations](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-cidr-reservation.html), [Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html), and [NAT gateway(s)](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) with an [Elastic IP](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-eips.html) address associated and mapped correctly.
- An [internet gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) to allow resources that get public IPs in the VPC tp be accessible from the internet.
- [VPC peering](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-peering.html) as required with resources outside the VPC.
- Full [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html) with appropriate retention and tiering for compliance and cost management.

See the [vars file](./vars.tf) for descriptions of the input parameters.