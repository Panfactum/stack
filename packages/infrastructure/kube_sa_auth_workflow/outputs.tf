output "role_arn" {
  description = "The ARN of the AWS role created for the service account."
  value       = module.aws_permissions.role_arn
}

output "role_name" {
  description = "The name of the AWS role created for the service account."
  value       = module.aws_permissions.role_name
}

output "policy_arn" {
  description = "The ARN of the policy assigned to the role."
  value       = module.aws_permissions.policy_arn
}

output "service_account_annotations" {
  description = "The annotations to apply to the service account"
  value = {
    "eks.amazonaws.com/role-arn" = module.aws_permissions.role_arn
  }
}
