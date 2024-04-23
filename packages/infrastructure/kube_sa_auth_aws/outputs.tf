output "role_arn" {
  description = "The ARN of the role created for the service account."
  value       = aws_iam_role.service_account.arn
}

output "role_name" {
  description = "The name of the role created for the service account."
  value       = aws_iam_role.service_account.name
}

output "policy_arn" {
  description = "The ARN of the policy assigned to the role."
  value       = aws_iam_policy.service_account.arn
}

output "service_account_annotations" {
  description = "The annotations to apply to the service account"
  value = {
    "eks.amazonaws.com/role-arn" = aws_iam_role.service_account.arn
  }
}
