output "keys" {
  description = "The signing keys for each domain"
  value = { for d in var.domain_names : d => {
    algorithm  = aws_route53_key_signing_key.keys[d].signing_algorithm_type
    flags      = aws_route53_key_signing_key.keys[d].flag
    public_key = aws_route53_key_signing_key.keys[d].public_key
    ds_record  = aws_route53_key_signing_key.keys[d].ds_record
  } }
}