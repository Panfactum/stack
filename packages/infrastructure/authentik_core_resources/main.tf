terraform {
  required_providers {
    authentik = {
      source  = "goauthentik/authentik"
      version = "2024.8.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  root_extra_groups             = { for name, config in var.extra_groups : name => config if config.parent == null }
  extra_groups_with_parent      = { for name, config in var.extra_groups : name => config if config.parent != null }
  child_extra_groups            = { for name, config in local.extra_groups_with_parent : name => config if contains(keys(local.root_extra_groups), config.parent) }
  grandchild_extra_groups       = { for name, config in local.extra_groups_with_parent : name => config if contains(keys(local.child_extra_groups), config.parent) }
  great_grandchild_extra_groups = { for name, config in local.extra_groups_with_parent : name => config if contains(keys(local.grandchild_extra_groups), config.parent) }
}

###########################################################################
## Brand
###########################################################################

resource "kubernetes_config_map_v1_data" "media" {
  metadata {
    name      = var.media_configmap
    namespace = var.authentik_namespace
  }
  data = {
    "logo.svg" = var.logo_svg_b64 != null ? base64decode(var.logo_svg_b64) : file("${path.module}/logo.svg")
  }
  field_manager = "authentik-core-resources"
  force         = true
}

// Note: Must first disable the default brand
resource "authentik_brand" "custom" {
  branding_title      = var.organization_name
  domain              = var.organization_domain
  branding_logo       = "/media/public/logo.svg"
  branding_favicon    = "/media/public/favicon.ico"
  flow_recovery       = authentik_flow.recovery.uuid
  flow_authentication = authentik_flow.authentication.uuid
  default             = true
}

###########################################################################
## Groups
###########################################################################

resource "authentik_group" "rbac" {
  name = "rbac"
  lifecycle {
    ignore_changes = [users]
  }
}

resource "authentik_group" "superusers" {
  name         = "superusers"
  is_superuser = true
  parent       = authentik_group.rbac.id
  lifecycle {
    ignore_changes = [users]
  }
}

resource "authentik_group" "default_groups" {
  for_each = toset(var.default_groups_enabled ? [
    "billing_admins",
    "privileged_engineers",
    "engineers",
    "restricted_engineers"
  ] : [])
  name   = each.key
  parent = authentik_group.rbac.id
  lifecycle {
    ignore_changes = [users]
  }
}

resource "authentik_group" "extra_groups_root" {
  for_each = local.root_extra_groups
  name     = each.key
  lifecycle {
    ignore_changes = [users]
  }
}

resource "authentik_group" "extra_groups_children" {
  for_each = local.child_extra_groups
  name     = each.key
  parent   = each.value.parent == "rbac" ? authentik_group.rbac.id : authentik_group.extra_groups_root[each.value.parent].id
  lifecycle {
    ignore_changes = [users]
  }
}


resource "authentik_group" "extra_groups_grandchildren" {
  for_each = local.grandchild_extra_groups
  name     = each.key
  parent   = authentik_group.extra_groups_children[each.value.parent].id
  lifecycle {
    ignore_changes = [users]
  }
}

resource "authentik_group" "extra_groups_great_grandchildren" {
  for_each = local.great_grandchild_extra_groups
  name     = each.key
  parent   = authentik_group.extra_groups_grandchildren[each.value.parent].id
  lifecycle {
    ignore_changes = [users]
  }
}


###########################################################################
## Login Stages
###########################################################################

resource "authentik_stage_user_login" "login" {
  name                     = "panfactum-login"
  session_duration         = var.session_duration
  terminate_other_sessions = true
}

###########################################################################
## MFA Stages
###########################################################################

resource "authentik_stage_authenticator_webauthn" "webauthn_setup" {
  name                     = "panfactum-webauthn-setup"
  friendly_name            = "WebAuthn"
  authenticator_attachment = "cross-platform"
  user_verification        = "preferred"
  resident_key_requirement = "preferred"
}

resource "authentik_stage_authenticator_totp" "totp_setup" {
  name          = "panfactum-totp-setup"
  digits        = 6
  friendly_name = "TOTP"
}

// This allows both webauthn and TOTP and will prompt
// the user to configure one if one is not already present
resource "authentik_stage_authenticator_validate" "mfa" {
  name                  = "panfactum-authenticator-validate"
  device_classes        = ["webauthn", "totp"]
  not_configured_action = "configure"

  # Sort required due to
  # https://github.com/goauthentik/terraform-provider-authentik/issues/377
  configuration_stages = sort([
    authentik_stage_authenticator_webauthn.webauthn_setup.id,
    authentik_stage_authenticator_totp.totp_setup.id
  ])
}

// This allows only webauthn which should be used for superusers
resource "authentik_stage_authenticator_validate" "mfa_webauthn_only" {
  name                  = "panfactum-authenticator-validate-webauthn-only"
  device_classes        = var.superusers_require_webauthn ? ["webauthn"] : authentik_stage_authenticator_validate.mfa.device_classes
  not_configured_action = "configure"
  configuration_stages = var.superusers_require_webauthn ? [
    authentik_stage_authenticator_webauthn.webauthn_setup.id
  ] : sort(authentik_stage_authenticator_validate.mfa.configuration_stages)
}

###########################################################################
## Policy Tests
###########################################################################

resource "authentik_policy_expression" "not_app_password" {
  expression = "return context.get(\"auth_method\") != \"app_password\""
  name       = "test_not_app_password"
}

resource "authentik_policy_expression" "is_superuser" {
  expression        = "return ak_is_group_member(context.get(\"pending_user\"), name=\"${authentik_group.superusers.name}\")"
  name              = "test_superuser"
  execution_logging = true
}

###########################################################################
## Recovery / Enrollment
###########################################################################

resource "authentik_flow" "recovery" {
  designation    = "recovery"
  name           = "Panfactum recovery flow"
  slug           = "panfactum-recovery-flow"
  title          = "Panfactum recovery flow"
  authentication = "require_unauthenticated"
}

resource "authentik_stage_email" "email" {
  name                     = "panfactum-recovery-email"
  use_global_settings      = true
  activate_user_on_success = true
  timeout                  = 60 * 24
  token_expiry             = 60 * 24
  template                 = "recovery.html"
  subject                  = "Reset your ${var.organization_name} account!"
}

resource "authentik_stage_prompt_field" "password" {
  field_key              = "password"
  label                  = "New password"
  name                   = "password"
  type                   = "password"
  placeholder            = "Password"
  required               = true
  order                  = 0
  placeholder_expression = false
}

resource "authentik_stage_prompt" "password" {
  name = "panfactum-recovery-prompt-password"
  fields = [
    authentik_stage_prompt_field.password.id
  ]
  # Sort required due to
  # https://github.com/goauthentik/terraform-provider-authentik/issues/377
  validation_policies = sort([
    authentik_policy_password.password_length.id,
    authentik_policy_password.password_pwnd.id,
    authentik_policy_password.password_complexity.id
  ])
}

resource "authentik_policy_password" "password_length" {
  name          = "panfactum-password-policy-min-length"
  length_min    = 16
  error_message = "Passwords must be at least 16 characters."
}

resource "authentik_policy_password" "password_pwnd" {
  name                    = "panfactum-password-policy-pwnd"
  check_have_i_been_pwned = true
  error_message           = "Password is in the HaveIBeenPwned database. Choose a different one."
}

resource "authentik_policy_password" "password_complexity" {
  name          = "panfactum-password-policy-complexity"
  check_zxcvbn  = true
  error_message = "Password is not strong enough. Choose a different one."
}

resource "authentik_stage_user_write" "write" {
  name               = "panfactum-recovery-write"
  user_creation_mode = "never_create"
}

resource "authentik_policy_expression" "skip_if_restored" {
  name       = "panfactum-recovery-skip-if-restored"
  expression = "return bool(request.context.get('is_restored', True))"
}

resource "authentik_policy_binding" "skip_if_restored_id" {
  order  = 0
  target = authentik_flow_stage_binding.recovery_id.id
  policy = authentik_policy_expression.skip_if_restored.id
}

resource "authentik_policy_binding" "skip_if_restored_email" {
  order  = 0
  target = authentik_flow_stage_binding.recovery_email.id
  policy = authentik_policy_expression.skip_if_restored.id
}

resource "authentik_flow_stage_binding" "recovery_id" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_identification.id.id
  order                   = 10
  evaluate_on_plan        = true
  re_evaluate_policies    = true
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

resource "authentik_flow_stage_binding" "recovery_email" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_email.email.id
  order                   = 20
  evaluate_on_plan        = true
  re_evaluate_policies    = true
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

resource "authentik_flow_stage_binding" "recovery_password" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_prompt.password.id
  order                   = 20
  evaluate_on_plan        = true
  re_evaluate_policies    = false
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

resource "authentik_flow_stage_binding" "recovery_mfa" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_authenticator_validate.mfa.id
  order                   = 30
  evaluate_on_plan        = true
  re_evaluate_policies    = false
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

resource "authentik_flow_stage_binding" "recovery_write" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_user_write.write.id
  order                   = 40
  evaluate_on_plan        = true
  re_evaluate_policies    = false
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

resource "authentik_flow_stage_binding" "recovery_login" {
  target                  = authentik_flow.recovery.uuid
  stage                   = authentik_stage_user_login.login.id
  order                   = 100
  evaluate_on_plan        = true
  re_evaluate_policies    = false
  policy_engine_mode      = "any"
  invalid_response_action = "retry"
}

###########################################################################
## Authentication
###########################################################################

resource "authentik_flow" "authentication" {
  designation    = "authentication"
  name           = "Panfactum authentication flow"
  slug           = "panfactum-authentication-flow"
  title          = "${var.organization_name} Login"
  authentication = "require_unauthenticated"
}

data "authentik_source" "inbuilt" {
  managed = "goauthentik.io/sources/inbuilt"
}

resource "authentik_stage_identification" "id" {
  name          = "panfactum-user-identification"
  user_fields   = ["username", "email"]
  sources       = [data.authentik_source.inbuilt.uuid]
  recovery_flow = authentik_flow.recovery.uuid
}

resource "authentik_stage_password" "password" {
  name     = "panfactum-password"
  backends = ["authentik.core.auth.InbuiltBackend"]
}

resource "authentik_flow_stage_binding" "authenticate_id" {
  target = authentik_flow.authentication.uuid
  stage  = authentik_stage_identification.id.id
  order  = 10
}

resource "authentik_flow_stage_binding" "authenticate_password" {
  target = authentik_flow.authentication.uuid
  stage  = authentik_stage_password.password.id
  order  = 20
}

resource "authentik_policy_binding" "ignore_mfa_for_app_password" {
  for_each = {
    1 = authentik_flow_stage_binding.authenticate_mfa.id,
    2 = authentik_flow_stage_binding.authenticate_webauthn.id
  }
  order  = 0
  target = each.value
  policy = authentik_policy_expression.not_app_password.id
}

resource "authentik_policy_binding" "require_mfa" {
  order  = 10
  target = authentik_flow_stage_binding.authenticate_mfa.id
  policy = authentik_policy_expression.is_superuser.id
  negate = true
}

resource "authentik_policy_binding" "require_webauthn_for_superuser" {
  order  = 10
  target = authentik_flow_stage_binding.authenticate_webauthn.id
  policy = authentik_policy_expression.is_superuser.id
}

resource "authentik_flow_stage_binding" "authenticate_mfa" {
  target             = authentik_flow.authentication.uuid
  stage              = authentik_stage_authenticator_validate.mfa.id
  order              = 30
  policy_engine_mode = "all"

  // This must only be run when the stage is reached
  // as otherwise the user will be anonymous and thus
  // we cannot check their groups
  evaluate_on_plan     = false
  re_evaluate_policies = true
}

resource "authentik_flow_stage_binding" "authenticate_webauthn" {
  target             = authentik_flow.authentication.uuid
  stage              = authentik_stage_authenticator_validate.mfa_webauthn_only.id
  order              = 30
  policy_engine_mode = "all"

  // This must only be run when the stage is reached
  // as otherwise the user will be anonymous and thus
  // we cannot check their groups
  evaluate_on_plan     = false
  re_evaluate_policies = true
}

resource "authentik_flow_stage_binding" "authenticate_login" {
  target = authentik_flow.authentication.uuid
  stage  = authentik_stage_user_login.login.id
  order  = 40
}



