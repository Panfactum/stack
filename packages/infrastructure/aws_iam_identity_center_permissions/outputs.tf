output "cli_config" {
  description = "To be used by the 'pf-aws-update --build' script"
  value = [for account, config in var.account_access_configuration : {
    account_name = account,
    account_id   = config.account_id
    roles        = ["Superuser", "Admin", "Reader", "RestrictedReader", "BillingAdmin"]
  }]
}
