# Dynamically Generated AWS Credentials

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

This module uses the [AWS secrets engine](https://developer.hashicorp.com/vault/docs/secrets/aws) of the Vault instance in the Kubernetes cluster
to provision an IAM User and associated credentials. The credentials are periodically rotated based on `credential_lifetime_hours`, but
no other security controls are applied (unlike [kube_sa_auth_aws](/main/reference/infrastructure-modules/submodule/kubernetes/kube_sa_auth_aws)).

<MarkdownAlert severity="warning">
   This module should *only* be used when [kube_sa_auth_aws](/main/reference/infrastructure-modules/submodule/kubernetes/kube_sa_auth_aws)
   is not suitable. The credentials provisioned by this module offers far less security than [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html),
   but occasionally you may need credentials that are not session-based.

   Some valid use cases for this module:
      - You are using a client that does not support IRSA (unlikely, all modern AWS clients do).
      - You need SMTP credentials for AWS SES.
      - You need to provide long-lived credentials to provide some third-party service.
</MarkdownAlert>


## Usage

This module will create an IAM user. The user will receive the permissions provided by `iam_policy_json`
(for inline permissions) or `iam_policy_arns` (for attaching existing IAM policies). Both can be specified.

The generated credentials are stored in the secret defined by the `creds_secret` output and are 
rotated every `credential_lifetime_hours` / 2.

This secret will contain two values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

As an example:

```hcl

data "aws_iam_policy_document" "permissions" {
   statement {
      ...
   }
}

module "user" {
  source = "${var.pf_module_source}kube_aws_creds${var.pf_module_ref}"
  ...
      
  iam_policy_json  = data.aws_iam_policy_document.permissions.json
  namespace        = var.namespace
}

module "deployment" {
  source = "${var.pf_module_source}kube_deployment${var.pf_module_ref}"
  ...
      
  namespace = local.namespace
  common_env_from_secrets = {
    AWS_ACCESS_KEY_ID = {
      secret_name = module.user.creds_secret
      key = "AWS_ACCESS_KEY_ID"
    }
    AWS_SECRET_ACCESS_KEY = {
      secret_name = module.user.creds_secret
      key = "AWS_SECRET_ACCESS_KEY"
    }
  }
}
```