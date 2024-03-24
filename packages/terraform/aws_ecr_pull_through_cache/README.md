# AWS ECR Pull Through Cache

**Type:** Live

This modules sets up [AWS ECR](https://aws.amazon.com/ecr/)
to serve as a pull through cache for publicly available container images
used in your Kubernetes clusters.

This provides several benefits:

 - Significantly improves startup time of both new nodes and new pods by pulling from localized
data storage rather than the public internet
 - Improves resiliency to outages of public container registries which might otherwise cripple
 your infrastructure
 - Avoids the risk of hitting the rate limits imposed by public registries
 - Reduces costs associated with NAT gateways by keeping large image transfers inside
your private network