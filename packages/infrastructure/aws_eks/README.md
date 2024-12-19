# Elastic Kubernetes Service (EKS)

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

This module provides our standard setup for a configurable AWS EKS Cluster.
It includes:

- An [EKS Cluster](https://docs.aws.amazon.com/eks/latest/userguide/clusters.html). This cluster defines the Kubernetes control plane (managed by AWS) and provisions it to the specified set of availability zones.

- A [KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) for encrypting the control plane data at-rest.

- Setup of [EKS Access Entries](https://docs.aws.amazon.com/eks/latest/userguide/access-entries.html).

- A set of "controller" [node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html) with a static size for running cluster-critical controllers. Nodes use the [Bottlerocket](https://bottlerocket.dev/) distribution. 
  Autoscaled nodes are deployed via our [kube_karpenter](/docs/main/reference/infrastructure-modules/kubernetes/kube_karpenter) module.

- [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) for both the cluster control plane and for the node groups.
    - The control plane accepts inbound traffic from the nodes and can make arbitrary outbound traffic.
    - The nodes accept inbound traffic from the control plane, from each other, and can make arbitrary outbound traffic.
  
- Subnet tags that controllers in our other modules depend upon.

- The requisite infrastructure for using [IAM roles for service accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).

## Usage

### Installation

#### Choose Control Plane Subnets

Control plane subnets are the subnets within which AWS will deploy the EKS-managed Kubernetes API servers.

By default, the control plane subnets will be any subnet named `PUBLIC_A`, `PUBLIC_B`, or `PUBLIC_C` in the VPC indicated
by the `vpc_id` input as these are the subnets created by the [aws_vpc](/docs/main/reference/infrastructure-modules/direct/aws/aws_vpc) module.

If you need to overwrite the default module behavior, you can specify `control_plane_subnets`. This input takes **at least 2** subnets (each in a different AZ).

#### Choose Node Subnets

<MarkdownAlert severity="warning">
  Your node subnets **cannot** be changed without downtime in the future.
</MarkdownAlert>

Node subnets are the subnets within which your actual workloads will run once deployed to the Kubernetes clsuter.

By default, the node subnets will be any subnet named `PRIVATE_A`, `PRIVATE_B`, or `PRIVATE_C` in the VPC indicated
by the `vpc_id` input as these are the subnets created by the [aws_vpc](/docs/main/reference/infrastructure-modules/direct/aws/aws_vpc) module.

If you need to overwrite the default module behavior, you can specify `node_subnets`.

For an [SLA target of level 2 or above](/docs/main/guides/deploying-workloads/high-availability), you MUST provide **at least 3** subnets (each in a different AZ).

### Overriding the Service CIDR

Kubernetes requires that you specify a range of IP addresses that can be allocated to [Services](https://kubernetes.io/docs/concepts/services-networking/service/) deployed in Kubernetes. This
is called the [Service CIDR](https://kubernetes.io/docs/concepts/services-networking/cluster-ip-allocation/).

We provide a default CIDR range of `172.20.0.0/16`. We strongly discourage overriding this default unless you
have a demonstrated need.

If you do override with the `service_cidr` input, you MUST provide a private CIDR range that does not conflict with your VPC or any of its subnets. That
is because Kubernetes performs its own routing and networking independently of AWS.

You will also need to choose a `dns_service_ip` which **must** be in the `service_cidr`. If you use the
`172.20.0.0/16` CIDR, then you should use `172.20.0.10` as this is the EKS default.

#### Post-install Steps

This module is intended to be installed as a part of [this guide](/docs/main/guides/bootstrapping/kubernetes-cluster) which includes manual steps
that must be run after applying the module.

## RBAC

This module configures access to the cluster via [EKS Access Entries](https://docs.aws.amazon.com/eks/latest/userguide/access-entries.html).

See the below table for our standard Kubernetes groups, the AWS principals linked to each group (configured through this module's
input variables), and the description of the intended permission level:

| Kubernetes Group        | Default AWS Principals Linked       | Extra AWS Principals Linked            | Permission Level                                                                                                                                                                                                            |
|-------------------------|-------------------------------------|----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `pf:superusers`         | Superuser SSO Role, `root` IAM User | `var.superuser_principal_arns`         | Full access to everything in the cluster. ([AmazonEKSClusterAdminPolicy](https://docs.aws.amazon.com/eks/latest/userguide/access-policy-permissions.html#access-policy-permissions-amazoneksclusteradminpolicy))            |
| `pf:admins`             | Admin SSO Role                      | `var.admin_princiapl_arns`             | Write access to everything besides core cluster utilities. ([AmazonEKSAdminViewPolicy](https://docs.aws.amazon.com/eks/latest/userguide/access-policy-permissions.html#access-policy-permissions-amazoneksadminviewpolicy)) |
| `pf:readers`            | Reader SSO Role                     | `var.reader_principal_arns`            | Read access to all resources (including secrets). ([AmazonEKSEditPolicy](https://docs.aws.amazon.com/eks/latest/userguide/access-policy-permissions.html#access-policy-permissions-amazonekseditpolicy))                    |
| `pf:restricted-readers` | RestrictedReader SSO Role           | `var.restricted_reader_principal_arns` | Read access to all resources (not including secrets). ([AmazonEKSViewPolicy](https://docs.aws.amazon.com/eks/latest/userguide/access-policy-permissions.html#access-policy-permissions-amazoneksviewpolicy.json))           |

The SSO roles are installed into each account via [aws_iam_identity_center_permissions](/docs/main/reference/infrastructure-modules/direct/aws/aws_iam_identity_center_permissions)
and are automatically discovered by this module. Users with access to a particular AWS IAM SSO role will have the corresponding permissions in all Panfactum clusters in
that AWS account.

You can explicitly grant additional AWS IAM principals (users and roles) access via the input variables outlined above (e.g., `var.superuser_principal_arns`).

Note that extra permissions are given to the `pf:admins` and `pf:restricted-readers` Kubernetes groups
in the [kube_policies](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_policies). AWS doesn't install
permissions that cover CRDs, so we add them ourselves once the cluster is instantiated.