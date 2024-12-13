# Elastic Kubernetes Service (EKS)

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

## Post-install Steps

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