output "node_role_arn" {
  description = "The ARN of the role assigned to controller nodes"
  value       = aws_iam_role.node_group.arn
}

output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.cluster.name
}

output "cluster_url" {
  description = "The URL for the Kubernetes API server"
  value       = aws_eks_cluster.cluster.endpoint
}

output "cluster_ca_data" {
  description = "The CA certificate for the Kubernetes API server"
  value       = aws_eks_cluster.cluster.certificate_authority[0].data
}

output "cluster_region" {
  description = "The AWS region to which the EKS cluster is deployed"
  value       = data.aws_region.region.name
}

output "node_instance_profile" {
  description = "The instance profile assigned to controller nodes"
  value       = aws_iam_instance_profile.node_group.name
}

output "user_data" {
  description = "The user data file provided to the controller nodes"
  value       = module.node_settings.user_data
}

output "node_security_group_id" {
  description = "ID of the security group assigned to controller nodes"
  value       = aws_security_group.all_nodes.id
}
