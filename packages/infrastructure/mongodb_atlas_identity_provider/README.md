import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

# Mongodb Atlas MongoDB Identity Provider

This module sets up the identity provider configuration in MongoDB Atlas.

<MarkdownAlert severity="warning">
  Due to limitations with MongoDB Atlas, users will not be automatically removed from MongoDB Atlas when they are removed from Authentik.

  They will lose the ability to login, but you should be aware of the following caveats:

  - If "Bypass SAML Mode" is enabled, users will be able to bypass Authentik and login directly to Atlas using their static usernames and passwords. As a result, we strongly recommend keeping this flag disabled.
  - Any active session tokens that the user has with the Atlas web UI will not be automatically revoked. Until these tokens expire, the user may still have the ability to interact with the web UI unless you manually remove them from the Atlas organization.
  - Atlas application keys are not scoped to a user's account. If the user had access to these keys, they may still be able to access Atlas even after their account is removed. As a result, ensure that you rotate application keys if removing a user in the superusers group (and any other group configured with access to application keys).
</MarkdownAlert>

## Guide

### Pre-req: Setup MongoDB Atlas Identity Provider Domain Verification

1. Go to your MongoDB Atlas account
2. Go to `Organization Settings` -> `Federated Authentication Settings` -> `Domains`
3. Click on `Add Domain`
4. Add the root domain that you are using for Authentik (ie: panfactum.com)
5. Select `DNS Record` as the verification method
6. Note the `TXT Record` that is generated

### Deploy a new DNS TXT Record & Verify

1. Add a text record to your `global/aws_dns/terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/global/aws_dns_records/terragrunt.hcl).
2. Run `terragrunt apply`
3. Go back to MongoDB Atlas and click on `Verify` next to the domain you added
4. Confirm verification

### Download the Signing Certificate from Authentik

Before proceeding, make sure to have downloaded the signing certificate from the Authentik application
1. Login to your Authentik instance
2. Switch over to the `Admin` section
3. Go to the section `Applications` -> `Providers` -> `MongoDB Atlas`
4. Find `Related objects` and click on the `Download` button for the `Download signing certificate`

### Deploy the MongoDB Identity Provider module

Unfortunately, the terraform provider for MongoDB Atlas does not support the creation of the Identity Provider but allows for modifications. 
We will first create the resource through the UI and then import it to configure further.

From MongoDB Atlas UI
1. Go to `Organization Settings`
2. Note the `Organization ID`
3. Go to `Federated Authentication Settings` -> `Identity Providers`
4. Click on `Configure Identity Provider`
5. Select `Workforce Identity Federation`
6. Select `SAML for Atlas UI Access`
7. Set a Name: `Authentik Integration`
8. Click on `Fill with placeholder values` for the Issuer URI and Single Sign-On URL
9. Upload the `Signing Certificate` that we downloaded above
10. Set the `Request Binding` to `HTTP-POST`
11. Set the `Response Signature Algorithm` to `SHA-256`
12. Continue to the next step 
13. Note the `ACS URL`
14. Note the `Audience URI`
15. Note the `IdP ID`
16. Note the `Federation Settings ID` Found in the url `https://cloud.mongodb.com/v2#/federation/{this-is-your-federation-settings-id}/overview`

Create Access Keys
1. Go to `Organization Settings` -> `Access Manager`
2. Click on `Applications` tab
3. Click on `Add new`
4. Set the description to `terraform`
5. Set the Organization Permission to `Organization Owner`
6. Save the public and private key to your `.env` file
   1. set `MONGODB_ATLAS_PUBLIC_KEY`
   2. set `MONGODB_ATLAS_PRIVATE_KEY`

From the terminal
1. Add a new a `mongodb_atlas_identity_provider` folder adjacent to your `authentik_core_resources` folder
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/mongodb_atlas_identity_provider/terragrunt.hcl)
3. Set the `federation_settings_id` to the value from above 
4. Set the `organization_id` to the value from above
5. Set the `idp_id` to the value from above
6. Set the `associated_domains` to the domain you verified above
7. Add a new `secrets.yaml` and add the public and private key from above
8. Run `pf-tf-init`
9. Run `terragrunt apply`

### Disable SSO Bypass

After you have confirmed and validated that SSO is working through Authentik, disable the Bypass SAML Mode toggle.

<MarkdownAlert severity="warning">
  Disabling this toggle will lock you out of your MongoDB Atlas account if you have not configured SSO correctly.
</MarkdownAlert>

1. Go to `Organization Settings` -> `Federated Authentication Settings` -> `Identity Providers`
2. Click on the `Authentik Integration` identity provider
3. Toggle `Bypass SAML Mode` to `off`