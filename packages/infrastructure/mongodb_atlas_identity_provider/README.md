# Mongodb Atlas MongoDB Identity Provider

This module sets up the identity provider configuration in MongoDB Atlas.

## Guide

This guide will help setup the MongoDB Atlas side of the SSO integration.

### Pre-req: Setup MongoDB Atlas Identity Provider Domain Verification

1. Go to your MongoDB Atlas account
2. Go to `Organization Settings` -> `Federated Authentication Settings` -> `Domains`
3. Click on `Add Domain`
4. Add the root domain that you are using for Authentik (ie: panfactum.com)
5. Select `DNS Record` as the verification method
6. Note the `TXT Record` that is generated

### Deploy a new DNS TXT Record & Verify

1. Add a text record to your `global/aws_dns/terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/global/aws_dns_records/terragrunt.hcl#118).
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
1. Go to `Organization Settings` -> `Federated Authentication Settings` -> `Identity Providers`
2. Click on `Configure Identity Provider`
3. Select `Workforce Identity Federation`
4. Select `SAML for Atlas UI Access`
5. Set a Name: `Authentik Integration`
6. Click on `Fill with placeholder values` for the Issuer URI and Single Sign-On URL
7. Upload the `Signing Certificate` that we downloaded above
8. Set the `Request Binding` to `HTTP-POST`
9. Set the `Response Signature Algorithm` to `SHA-256`
10. Continue to the next step 
11. Note the `ACS URL`
12. Note the `Audience URI`
13. Note the `IdP ID`
14. Note the `Federation Settings ID` Found in the url `https://cloud.mongodb.com/v2#/federation/{this-is-your-federation-settings-id}/overview`

Create Access Keys
1. Go to `Organization Settings` -> `Access Manager`
2. Click on `Applications` tab
3. Click on `Add new`
4. Set the description to `terraform`
5. Set the Organization Permission to `Organization Owner`
6. Save the public and private key

From the terminal
1. Add a new a `mongodb_atlas_identity_provider` folder adjacent to your `authentik_core_resources` folder
2. Add a new a `terragrunt.hcl` file that looks like [this](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/environments/production/us-east-2/mongodb_atlas_identity_provider/terragrunt.hcl)
3. Set the `federation_settings_id` to the value from above 
4. Set the `idp_id` to the value from above
5. Set the `associated_domains` to the domain you verified above
6. Add a new `secrets.yaml` and add the public and private key from above
7. Encrypt with `sops -e -i secrets.yaml`
8. Run `pf-tf-init`
9. Run `terragrunt apply`