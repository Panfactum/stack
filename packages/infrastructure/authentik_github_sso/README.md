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

### Start the GitHub SAML SSO Setup

1. Log in to GitHub and navigate to your enterprise's dashboard. For example, Panfactum's enterprise url is https://github.com/enterprises/Panfactum.
2. Go to Settings -> Authentication security.
3. Toggle on `Require SAML authentication`.
4. Note the `assertion consumer service URL`. We will use this in the following step.
   ![GitHub ACS URL](doc_images/github-acs-url.png)
   

### Deploy GitHub Provider & Application in Authentik

1. Add a new `authentik_github_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_github_sso/terragrunt.hcl).
3. Set the `acs_url` input using the `assertion consumer service URL` from above.
4. Run `pf-tf-init`.
5. Run `terragrunt apply`.
6. Note the output as you'll use it in the following steps.

### Complete GitHub SAML single sign-on

1. Resume the Authentication security page
2. Go to Security -> Authentication security.
3. Set `Sign on URL` with the `sso_post_url` output value from above.
4. Set `Issuer` with the `issuer_url` output value from above.
5. Set `Public certificate` from the `certificate` output value from above.
   ![SAML Form](doc_images/github-saml-form.png)
6. Click on `Test SAML configuration`.
7. Save the `recovery codes` that you are prompted with.
8. Click on `Save`.

### Test and Turn on Require SAML SSO

1. Go to your Authentik instance.
2. Find the GitHub application. Ensure you are in the user dashboard, not the admin dashboard.
   ![Github Application](doc_images/github-application.png)
3. Click and confirm that you are able to login.