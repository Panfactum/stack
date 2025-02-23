# Authentik Github SSO

This module configures Authentik for integration with Github SAML single sign-on.

***Note:*** The GitHub Enterprise plan is required for SSO.   

<MarkdownAlert severity="warning">
  This module only handles authentication and does not provision or de-provisioning users at this time.
  Due to this limitations, users will not be automatically created or removed from Github when they are removed from Authentik.

  When they are removed from Authentik, they will lose the ability to access the organization, but you should be aware of the following caveats:

  - If "Require SAML SSO authentication for all members" is not enabled, users will be able to access the organization until they are manually removed. 
    As a result, we strongly recommend keeping the [Require SAML SSO](#test-and-turn-on-require-saml-sso) enabled after initial setup.
  - Any active session tokens that the user has with the Github web UI will not be automatically revoked. Until these
    tokens expire, the user may still have the ability to interact with the web UI unless you manually remove them from
    the Github organization.
</MarkdownAlert>

## Guide

### Deploy Github Provider & Application in Authentik

1. Add a new a `authentik_github_sso` folder adjacent to your `authentik_core_resources` folder.
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/authentik_github_sso/terragrunt.hcl).
3. Run `pf-tf-init`
4. Run `terragrunt apply`
5. Note the output as you'll use it in the following steps

### Setup Github SAML single sign-on

1. Login github and navigate to your organizations Settings
2. Go to Security -> Authentication security
3. Toggle on `Enable SAML authentication`
4. Set `Sign on URL` with the `url_sso_post` output value from above
5. Set `Issuer` with the `issuer_url` output value from above
6. Set `Public certificate` from the `saml_metadata` output value from above
    - copy the contents from within the `<ds:X509Certificate>` section of the xml
    - paste within `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`
   ```
   -----BEGIN CERTIFICATE-----
   <your-pasted-value>
   -----END CERTIFICATE-----
   ```
   ![SAML Form](doc_images/github-saml-form.png)
7. Keep `Require SAML SSO authentication for all members ...` unchecked.
8. Save
9. Note the `assertion consumer service URL` and `organziation single sign-on URL`. We will need it next.


### Sync Authentik with the Github Settings

![Audience and ACS URL](doc_images/github-audience-acs-url.png)

1. Copy and set the `assertion consumer service URL` from Github to the `acs_url` input
2. Copy and set the `organziation single sign-on URL` but without `/sso` from Github to the `audience` input
3. Run `terragrunt apply`

### Test and Turn on Require SAML SSO

1. Go to your Authentik instance
2. Find the Github application
3. Click and confirm that you are able to login

Once confirmed that the SSO integration is working, it is optional but recommended to turn on the `Require SAML SSO authentication`. 
![Require SAML SSO Authentication](doc_images/github-require-saml-sso.png). Not turning this on will prevent you from controlling access from a single source, authentik.  