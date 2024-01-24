output "arn" {
  value = aws_kms_key.key.arn
}

output "alias_arn" {
  value = aws_kms_alias.alias.arn
}

output "id" {
  value = aws_kms_key.key.id
}