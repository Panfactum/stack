output "aws_accounts" {
  description = "The AWS accounts that were provisioned in the organization"
  value       = aws_organizations_account.accounts
}