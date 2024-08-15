output "arguments" {
  description = "The arguments to the WorkflowTemplate"
  value       = module.tf_deploy_workflow.arguments
}

output "aws_role_name" {
  description = "The name of the AWS role used by the Workflow's Service Account"
  value       = module.tf_deploy_workflow.aws_role_name
}

output "aws_role_arn" {
  description = "The name of the AWS role used by the Workflow's Service Account"
  value       = module.tf_deploy_workflow.aws_role_arn
}

output "vault_role_name" {
  description = "The name of the Vault role used by the Workflow's Service Account"
  value       = module.tf_deploy_vault_role.role_name
}

output "name" {
  description = "The name of the WorkflowTemplate"
  value       = var.name
}

output "entrypoint" {
  description = "The name of the first template in the Workflow"
  value       = local.entrypoint
}
