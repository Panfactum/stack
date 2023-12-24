# AWS Core Permissions

Provides standard IAM policy definitions for the core roles used across AWS accounts. Exports them as terraform outputs
for use in consuming modules. Does NOT actually create the policy infrastructure.

Provides the following policies:

1. `admin_policy_json` - Policy that allows read-write access to most resources and secrets in the environment. Does not
allow destroying or mutating the "protected" resources or creating persistent security vulnerabilities.

2. `reader_policy_json` - Policy that allows read-only access to only the resources we use at Bambee. Does not allow
access to secrets. The "protected" resources are invisible.

3. `ci_reader_policy_json` - Policy that allows bot readers to read secrets and protected s3 buckets so that
infrastructure planning can work. Also allows the ability to add and remove items from the protected dynamodb tables.

Note: The superuser role just uses the AWS managed policy `arn:aws:iam::aws:policy/AdministratorAccess` which allows
unmitigated access.
