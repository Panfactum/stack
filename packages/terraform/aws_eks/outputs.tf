output "node_role_arn" {
  value = aws_iam_role.node_group.arn
}

output "cluster_name" {
  value = aws_eks_cluster.cluster.name
}

output "cluster_url" {
  value = aws_eks_cluster.cluster.endpoint
}

output "cluster_ca_data" {
  value = aws_eks_cluster.cluster.certificate_authority[0].data
}

output "cluster_region" {
  value = data.aws_region.region.name
}

output "node_instance_profile" {
  value = aws_iam_instance_profile.node_group.name
}

output "user_data" {
  value = module.node_settings.user_data
}

output "node_security_group_id" {
  value = aws_security_group.all_nodes.id
}
