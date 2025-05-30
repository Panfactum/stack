import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

# Authentik GitHub SSO

This module configures Authentik for integration with GitHub SAML single sign-on.

***Note:*** The [GitHub Enterprise plan](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/using-saml-for-enterprise-iam/configuring-saml-single-sign-on-for-your-enterprise) is required for SSO.   

<MarkdownAlert severity="warning">
  Due to limitations with GitHub, this module only handles authentication and does not support user provisioning or de-provisioning at this time. As a result, users will not be automatically created or removed from GitHub when they are added or removed from Authentik.

  When a user is removed from Authentik, they will lose access to the organization. However, be aware of the following caveats:
  - Any active session tokens that the user has with the GitHub web UI and PATs the user may have generated will not be automatically revoked. Until these tokens expire, the user may still interact with the web UI / API unless they are manually removed from the GitHub organization.
</MarkdownAlert>
    
## Guide

<MarkdownAlert severity="warning">
  This guide sets up SAML SSO at the enterprise level, not the organization level. This is important because:
  - An enterprise-level integration provides SSO coverage for all organizations within your GitHub Enterprise
  - This eliminates the need to configure separate SSO integrations for each organization
  - All authentication will be managed through a single integration point

  While this guide focuses on enterprise-level setup, the same steps can be followed for organization-level SSO by selecting the organization settings instead of enterprise settings in GitHub.
</MarkdownAlert>

### Start the GitHub SAML SSO Setup

1. Log in to GitHub and navigate to your enterprise's dashboard. For example, Panfactum's enterprise url is https://github.com/enterprises/Panfactum.
  1. Click on your profile picture in the top right corner.
  1. Select `Your enterprises`.
  1. Click on `settings` for your enterprise name. 
1. Go to Authentication security.
1. Toggle on `Require SAML authentication`.
1. Note the `assertion consumer service URL`. We will use this in the following step.
   ![GitHub ACS URL](doc_images/github-acs-url.png)
   

### Deploy GitHub Provider & Application in Authentik

1. Add a new `authentik_github_sso` folder adjacent to your `authentik_core_resources` folder.
1. Add a new `terragrunt.hcl` file that looks like this:

    ::: code-group labels=[authentik_github_sso/terragrunt.hcl]
    ```hcl collapse={1-9} "REPLACE_ME"
    include "panfactum" {
      path   = find_in_parent_folders("panfactum.hcl")
      expose = true
    }

    terraform {
      source = include.panfactum.locals.pf_stack_source
    }

    dependency "authentik_core" {
      config_path = "../authentik_core_resources"
    }

    dependency "kube_authentik" {
      config_path = "../kube_authentik"
    }

    inputs = {
      organization_name = dependency.authentik_core.outputs.organization_name
      authentik_domain  = dependency.kube_authentik.outputs.domain

      // Set to the `assertion consumer service URL` from above.
      // Example: https://github.com/enterprises/Panfactum/saml/consume
      acs_url = "REPLACE_ME"
    }
    ```
    :::  

1. Run `pf-tf-init`.
1. Run `terragrunt apply`.
1. Note the output as you'll use it in the following steps.

### Complete GitHub SAML single sign-on

1. Resume the Authentication security page
1. Go to Security -> Authentication security.
1. Set `Sign on URL` with the `sso_post_url` output value from above.
1. Set `Issuer` with the `issuer_url` output value from above.
1. Set `Public certificate` from the `certificate` output value from above.
   ![SAML Form](doc_images/github-saml-form.png)
1. Click on `Test SAML configuration`.
1. Save the `recovery codes` that you are prompted with.
1. Click on `Save`.

### Test and Validate the Integration

1. Go to your Authentik instance.
1. Find the GitHub application. Ensure you are in the user dashboard, not the admin dashboard.
   ![GitHub Application](doc_images/github-application.png)
1. Click and confirm that you are able to login.