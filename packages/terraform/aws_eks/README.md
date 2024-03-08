# Elastic Kubernetes Service (EKS)

**Type:** Live

This module provides our standard set up for a configurable AWS EKS Cluster. It includes:
- An [EKS Cluster](https://docs.aws.amazon.com/eks/latest/userguide/clusters.html). This cluster defines the Kubernetes control plane (managed by AWS) and provisions it to the specified set of availability zones.
- Node groups for the EKS cluster.
- Security Groups for both the cluster control plane and for the node groups. The control plane accepts inbound traffic from the nodes and can make arbitrary outbound traffic. The nodes accept inbound traffic from the control plane, from each other, and can make arbitrary outbound traffic.

Additionally, we use the following [EKS add-ons](https://docs.aws.amazon.com/eks/latest/userguide/eks-add-ons.html):
  - [coredns](https://docs.aws.amazon.com/eks/latest/userguide/managing-coredns.html)
  - [kube-proxy](https://docs.aws.amazon.com/eks/latest/userguide/managing-kube-proxy.html)
  - [vpc-cni](https://docs.aws.amazon.com/eks/latest/userguide/managing-vpc-cni.html)

See the [vars file](./vars.tf) for descriptions of the input parameters.