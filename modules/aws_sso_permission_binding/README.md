# AWS SSO Permission Bindings

Submodule to bind AWS permission sets to Okta directory groups on a per environment basis. Includes:
- The creation of okta groups, rules, and a binding to the okta aws application
- The binding of those groups (propogated to AWS through SCIM) to the associated AWS account (environment)