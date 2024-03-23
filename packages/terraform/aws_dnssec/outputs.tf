output "keys" {
  description = "The signing keys for each domain"
  value = { for name, config in aws_route53_key_signing_key.keys : name => {
    algorithm  = config.signing_algorithm_type
    flags      = config.flag
    public_key = config.public_key
    ds_record  = config.ds_record
  } }
}