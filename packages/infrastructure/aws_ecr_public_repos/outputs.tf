output "ecr_repositories" {
  value = aws_ecrpublic_repository.repo
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  value = data.aws_region.current.name
}

output "registry" {
  value = "public.ecr.aws"
}
