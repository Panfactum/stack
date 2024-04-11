output "admin_policy_json" {
  value = data.aws_iam_policy_document.admin_policy.json
}

output "reader_policy_json" {
  value = data.aws_iam_policy_document.reader_policy.json
}

output "restricted_reader_policy_json" {
  value = data.aws_iam_policy_document.restricted_reader_policy.json
}
