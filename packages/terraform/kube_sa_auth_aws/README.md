# AWS Authentication via Kubernetes Service Account

**Type:** Submodule

Gives a kubernetes service account in an EKS cluster access to an AWS IAM role through IRSA.

This allows our Kubernetes pods to utilize the AWS API without static credentials. The IRSA functionality
is included in the latest version of all AWS SDKs so code should be able to pick up the IRSA credentials
using the implicit AWS provider-chain resolver (i.e., code changes to utilize these credentials is generally not required).

See [the IRSA docs](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) for more information.