# Elastic Kubernetes Service (EKS)

**Type:** Live

This module provides our standard setup for a configurable AWS EKS Cluster.
It includes:
- An [EKS Cluster](https://docs.aws.amazon.com/eks/latest/userguide/clusters.html). This cluster defines the Kubernetes control plane (managed by AWS) and provisions it to the specified set of availability zones.

- A [KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) for encrypting the control plane data at-rest.

- A set of controller [node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
  with a static size for running cluster-critical
  controllers. Nodes use the [Bottlerocket](https://bottlerocket.dev/) distribution.
  Autoscaled nodes are deployed via our [kube_karpenter](/docs/reference/infrastructure-modules/kube_karpenter) module.

- [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)
  for both the cluster control plane and for the node groups. 

    - The control plane accepts inbound traffic from the nodes and can make arbitrary outbound traffic.
  
    - The nodes accept inbound traffic from the control plane, from each other, and can make arbitrary outbound traffic.
  
- Subnet tags that controllers in our other modules depend upon.

- The requisite infrastructure for using
  [IAM roles for service accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).

- Logging for the control plane components via
  [AWS Cloudwatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html).

Additionally, we use the following [EKS add-ons](https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html):

  - [coredns](https://docs.aws.amazon.com/eks/latest/userguide/managing-coredns.html)