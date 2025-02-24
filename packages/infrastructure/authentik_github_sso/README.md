import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

# Authentik GitHub SSO

This module configures Authentik for integration with GitHub SAML single sign-on.

***Note:*** The [GitHub Enterprise plan](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/using-saml-for-enterprise-iam/configuring-saml-single-sign-on-for-your-enterprise) is required for SSO.   

<MarkdownAlert severity="warning">
  Due to limitations with GitHub, this module only handles authentication and does not support user provisioning or de-provisioning at this time.
  As a result, users will not be automatically created or removed from GitHub when they are added or removed from Authentik.

  When a user is removed from Authentik, they will lose access to the organization. However, be aware of the following caveats:

  - If "Require SAML SSO authentication for all members" is not enabled, users may still access the organization until they are manually removed. 
    Therefore, we strongly recommend enabling the [Require SAML SSO Authentication](#test-and-turn-on-require-saml-sso) after initial setup.
  - Any active session tokens that the user has with the GitHub web UI and PATs the user may have generated will not be automatically revoked. 
    Until these tokens expire, the user may still interact with the web UI / API unless they are manually removed from the GitHub organization.
</MarkdownAlert>

## Guide

### Deploy GitHub Provider & Application in Authentik

1. Add a new `authentik_github_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_github_sso/terragrunt.hcl).
3. Run `pf-tf-init`.
4. Run `terragrunt apply`.
5. Note the output as you'll use it in the following steps.

### Setup GitHub SAML single sign-on

1. Log in to GitHub and navigate to your organizations Settings.
2. Go to Security -> Authentication security.
3. Toggle on `Enable SAML authentication`.
4. Set `Sign on URL` with the `sso_post_url` output value from above.
5. Set `Issuer` with the `issuer_url` output value from above.
6. Set `Public certificate` from the `saml_metadata` output value from above.
    - Copy the contents from within the `<ds:X509Certificate>` section of the xml
    - Paste within `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`
   ```text
   -----BEGIN CERTIFICATE-----
   <your-pasted-value>
   -----END CERTIFICATE-----
   ```
   ![SAML Form](doc_images/github-saml-form.png)
7. Keep `Require SAML SSO authentication for all members ...` unchecked.
8. Click on `Save`.
9. Note the `assertion consumer service URL` and `organization single sign-on URL`. We will these later.


### Sync Authentik with the GitHub Settings

![Audience and ACS URL](doc_images/github-audience-acs-url.png)

1. Copy and set the `assertion consumer service URL` from GitHub to the `acs_url` input.
2. Copy and set the `organization single sign-on URL` but without `/sso` from GitHub to the `audience` input. For example
   if the URL is `https://github.com/orgs/my-org-name/sso` then set the audience to `https://github.com/orgs/my-org-name` 
3. Run `terragrunt apply`.

### Test and Turn on Require SAML SSO

1. Go to your Authentik instance.
2. Find the GitHub application. Ensure you are in the user dashboard, not the admin dashboard.
   ![Github Application](doc_images/github-application.png)
3. Click and confirm that you are able to login.

Once the SSO integration is confirmed to be working, enable `Require SAML SSO authentication`. 
![Require SAML SSO Authentication](doc_images/github-require-saml-sso.png)
Leaving this disabled will negate benefits of the SSO integration with Authentik.  