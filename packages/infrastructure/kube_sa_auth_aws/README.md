# AWS Authentication via Kubernetes Service Account

Gives a Kubernetes service account in an EKS cluster access to an AWS IAM role through IRSA.

This allows our Kubernetes pods to utilize the AWS API without static credentials. The IRSA functionality
is included in the latest version of all AWS SDKs so code should be able to pick up the IRSA credentials
using the [implicit AWS provider-chain resolver](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html) (i.e., code changes to utilize these credentials is generally not required).

See [the IRSA docs](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) for more information.

## Usage

### Simple Example

```hcl
module "example_deployment" { 
  source     = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"

  name       = "example"
  namespace  = var.namespace
}

data "aws_iam_policy_document" "example" {

  # Replace with your IAM permissions
  statement {
    effect = "Allow"
    actions = [
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeAddresses",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeVpcs",
      "ec2:DescribeVpcPeeringConnections",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeInstances",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeTags"
    ]
    resources = ["*"]
  }
}

module "aws_permissions" {
  source     = "${var.pf_module_source}kube_sa_auth_aws${var.pf_module_ref}"
   
  service_account           = module.example_deployment.service_account_name
  service_account_namespace = var.namespace
  iam_policy_json           = data.aws_iam_policy_document.example.json
}
```

### IP Allowlists

To mitigate credential exfiltration attacks,
generated credentials may only be used by pods running inside the cluster's subnets. These
subnets are subnets with the `kubernetes.io/cluster/<cluster_name>` tag set. This is automatically
configured by the [aws_eks](/docs/main/reference/infrastructure-modules/submodule/aws/aws_eks) module.

If you need to allow additional entities to use these credentials, you must manually
add their CIDRs to the `ip_allow_list` input.

### Presigned S3 URLs

AWS allows you to generate presigned URLs for S3 objects which can be a convenient way to give
users the ability to access specific files without needing to set up file-streaming infrastructure.

However, presigned URLs won't work outside of the cluster's VPC since the 
[the capabilities of a presigned URL are limited by the permissions of the entity that created it,](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html#PresignedUrlUploadObject-LimitCapabilities) and Kubernetes service accounts
are IP-restricted to only work from within the cluster.

To work around this, you can set the `allow_public_s3_presigned_urls` input to `true`. This will slightly weaken this module's
security controls to allow the service account to generate presigned URLs that can be used without IP restriction.

### Debugging

To verify that this module has created the correct permissions, you should check
the following:

1. The pod's service account has the `eks.amazonaws.com/role-arn` annotation set.
1. Each container have the following environment variables set (should be set automatically):
    - `AWS_ROLE_ARN`
    - `AWS_WEB_IDENTITY_TOKEN_FILE`

If both of those statements are true, that means that *authentication* via IRSA (OIDC) is working
correctly; however, *authorization* might still be broken.

To verify, use the AWS console to check the following:
1. The role identified by `AWS_ROLE_ARN` has the correct permissions.
1. The role's `*ip-block*` policy allows traffic from both your internal cluster IP address
ranges (subnet CIDRs) and the public IP addresses assigned to the cluster's VPC's NAT nodes.

If you believe all of the above is true, you may finally verify by examining the [AWS CloudTrail
Event History](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html):

1. Ensure your region is set to your cluster's region.
1. Examine the logs for any events with an error code. If you see any, resolve the indicated error.