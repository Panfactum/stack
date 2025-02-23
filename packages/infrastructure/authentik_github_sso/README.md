# Authentik Github SSO

This module configures Authentik for integration with Github SAML single sign-on.

***Note:*** The GitHub Enterprise plan is required for SSO.   

<MarkdownAlert severity="warning">
  This module only handles authentication and does not support user provisioning or de-provisioning at this time.
  As a result, users will not be automatically created or removed from GitHub when they are added or removed from Authentik.

  When a user is removed from Authentik, they will lose access to the organization. However, be aware of the following caveats:

  - If Require SAML SSO authentication for all members is not enabled, users may still access the organization until they are manually removed. 
    Therefore, we strongly recommend enabling the [Require SAML SSO Authentication](#test-and-turn-on-require-saml-sso) after initial setup.
  - Any active session tokens that the user has with the GitHub web UI will not be automatically revoked. 
    Until these tokens expire, the user may still interact with the web UI unless they are manually removed from the GitHub organization.
</MarkdownAlert>

## Guide

### Deploy Github Provider & Application in Authentik

1. Add a new a `authentik_github_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_github_sso/terragrunt.hcl).
3. Run `pf-tf-init`.
4. Run `terragrunt apply`.
5. Note the output as you'll use it in the following steps.

### Setup Github SAML single sign-on

1. Login github and navigate to your organizations Settings.
2. Go to Security -> Authentication security.
3. Toggle on `Enable SAML authentication`.
4. Set `Sign on URL` with the `url_sso_post` output value from above.
5. Set `Issuer` with the `issuer_url` output value from above.
6. Set `Public certificate` from the `saml_metadata` output value from above.
    - copy the contents from within the `<ds:X509Certificate>` section of the xml
    - paste within `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`
   ```
   -----BEGIN CERTIFICATE-----
   <your-pasted-value>
   -----END CERTIFICATE-----
   ```
   ![SAML Form](doc_images/github-saml-form.png)
7. Keep `Require SAML SSO authentication for all members ...` unchecked.
8. Click on Save.
9. Note the `assertion consumer service URL` and `organziation single sign-on URL`. We will need it next.


### Sync Authentik with the Github Settings

![Audience and ACS URL](doc_images/github-audience-acs-url.png)

1. Copy and set the `assertion consumer service URL` from Github to the `acs_url` input.
2. Copy and set the `organziation single sign-on URL` but without `/sso` from Github to the `audience` input.
3. Run `terragrunt apply`.

### Test and Turn on Require SAML SSO

1. Go to your Authentik instance.
2. Find the Github application.
3. Click and confirm that you are able to login.

Once SSO integration is confirmed to be working, it is recommended to enable `Require SAML SSO authentication`. 
![Require SAML SSO Authentication](doc_images/github-require-saml-sso.png) 
Not enabling this setting will prevent centralized access control through Authentik.  