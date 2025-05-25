# Kubernetes External DNS

This module provides a deployment of the [external-dns](https://github.com/kubernetes-sigs/external-dns) project.

It is set up to work with both AWS Route53 and Cloudflare as part of the complete Panfactum stack.

## Usage

## AWS Route53
For Route53, you can specify multiple zones and their corresponding IAM roles:

```hcl
module "external_dns" {
  # ... other configuration ...

  route53_zones = {
    "example.com" = {
      record_manager_role_arn = "arn:aws:iam::123456789012:role/ExampleRole"
      zone_id                 = "Z1234567890ABCDEF"
    },
    "subdomain.example.com" = {
      record_manager_role_arn = "arn:aws:iam::123456789012:role/SubdomainRole"
      zone_id                 = "Z0987654321FEDCBA"
    }
  }
}
```

### Cloudflare

For Cloudflare, you can specify multiple zones:

```hcl
module "external_dns" {
  # ... other configuration ...

  cloudflare_zones = {
    "example.com" = {
      zone_id = "abcdef1234567890"
    },
    "another-example.com" = {
      zone_id = "1234567890abcdef"
    }
  }

  cloudflare_api_token = var.cloudflare_api_token
}
```

#### Cloudflare API Token

To use Cloudflare with this module, you need to create an API token with the correct permissions. Follow these steps to create the token:

1. Log in to the Cloudflare dashboard.
1. Navigate to User Profile > API Tokens.
1. Click "Create Token".
1. Choose "Create Custom Token".
1. Set the following permissions:
  - Zone - Zone - Read
  - Zone - DNS - Edit
1. Under "Zone Resources", select "Include - All Zones".
1. Expiration: recommended to not set an expiration.
1. Create the token and securely store the generated values through SOPS.

For detailed instructions, refer to the [official Cloudflare guide on creating API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).