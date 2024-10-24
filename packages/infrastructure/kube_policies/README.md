# Kubernetes RBAC

This module configures the basic scaffolding for linking AWS IAM roles to Kubernetes RBAC roles by setting up
the `aws-auth` ConfigMap used by the [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator)
project. This enables user authentication to cluster resources through AWS. 

While it sets up the initial linkages and global permissions, **the majority of the permissions are deployed on the
namespace level through the namespace module in access-control.**

See the below table for our standard Kubernetes groups, the AWS roles linked to each group (through this module'
input variables), and the description of the intended permission level.

| Kubernetes Group     | AWS Roles Linked                | Permission Level                                           |
|----------------------|---------------------------------|------------------------------------------------------------|
| `system:superusers`  | `var.kube_superuser_role_arns`  | `cluster-admin`                                            |
| `system:admins`      | `var.kube_admin_role_arns`      | Write access to everything besides core cluster utilities. |
| `system:readers`     | `var.kube_reader_role_arns`     | Read access to all non-admin resources except secrets.     |

## Maintainer Notes

- This requires the cluster first be deployed via the [aws_eks module](/docs/main/reference/infrastructure-modules/aws/aws_eks).

- You will need to import the `kubernetes_config_map.aws_auth` resource and apply those changes in order for the nodes
  to successfully register. You will need to use the credentials of the cluster owner (the IAM entity that originally created the cluster).
