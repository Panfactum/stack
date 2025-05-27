include "panfactum" {
   path   = find_in_parent_folders("panfactum.hcl")
   expose = true
}

terraform {
   source = include.panfactum.locals.pf_stack_source
}

dependency "vault" {
   config_path  = "../kube_vault"
   skip_outputs = true
}

locals {
   // todo: utilize module.secrets.yaml
   secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

// todo: move to module.yaml
inputs = {
   // The `client_secret` output from `authentik_vault_sso`
   // Example: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx
   client_secret      = local.secrets.client_secret

   superuser_groups         = ["superusers"]
   admin_groups             = ["privileged_engineers"]
   reader_groups            = ["engineers"]
   restricted_reader_groups = ["restricted_engineers"]
}
