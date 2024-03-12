## Usage

### NAT

Our NAT implementation is a customized version
of the [fck-nat](https://fck-nat.dev/stable/)
project.

This means that instead of using an [AWS NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html), we perform NAT through
EC2 instances deployed into autoscaling groups.

Why? NAT Gateways are _extremely_ expensive for what they do. For many organizations,
this single infrastructure component can be 10-50% of total AWS spend. Because NAT
is trivial to implement in linux, we can reduce this spend by over 90% by implementing
it ourselves as we do in this module.

While we take inspiration from the fck-nat project, we enhance their scripts to also
include assigning static public IPs. This is important in many environments for
IP whitelisting purposes.

This setup does come with some limitations:

- _Outbound_ network bandwidth is limited to 5 Gbit/s per AZ (vs 25 Gbit/s for AWS NAT Gateways)
- _Outbound_ network connectivity in each AZ is impacted by the health of a single EC2 node

In practice, these limitations rarely impact an organization, especially as they only
impact _outbound_ connections (not inbound traffic):

- If you need > 5 Gbit/s of outbound public internet traffic, you would usually establish
  a private network tunnel to the destination to improve throughput beyond even 25 Gbit/s.
- The EC2 nodes are _extremely_ stable as NAT only relies on functionality that is
  native to the linux kernel (we have never seen a NAT node crash). 
- The primary downside  is that during NAT node upgrades, 
  outbound network connectivity will be temporarily
  suspended. This typically manifests as a ~2 minute delay in outbound traffic. Upgrades
  are typically only necessary every 6 months, so you can still easily achieve 99.99% uptime
  in this configuration.

## Future Enhancements

### NAT

- [Reduce fck-nat downtime during node upgrades](https://github.com/Panfactum/stack/issues/12)
- [Allow using AWS NAT Gateway instead of fck-nat](https://github.com/Panfactum/stack/issues/13)