output "keys" {
  description = "The signing keys for each domain"
  value = { for key in aws_route53_key_signing_key.keys : key.hosted_zone_id => {
    algorithm  = key.signing_algorithm_type
    flags      = key.flag
    public_key = key.public_key
    ds_record  = key.ds_record
  } }
}