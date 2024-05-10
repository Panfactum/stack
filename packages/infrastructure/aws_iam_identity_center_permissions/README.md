# AWS IAM Identity Center Permissions

Creates the three core permission tiers for each AWS account:

   1. `superusers` - Maps to the `arn:aws:iam::aws:policy/AdministratorAccess` managed policy
   
   2. `admins` - Maps to a role that has admin access to most items but attempts to block permissions that could create obvious security problems or delete key infrastructure
   
   3. `readers` - Read-only access to the specific subset of AWS resources used in the Panfactum stack

