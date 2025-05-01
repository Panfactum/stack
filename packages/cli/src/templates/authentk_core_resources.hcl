include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

inputs = {
  authentik_namespace       = dependency.kube_authentik.outputs.namespace
  email_templates_configmap = dependency.kube_authentik.outputs.email_templates_configmap
  media_configmap           = dependency.kube_authentik.outputs.media_configmap

  // How you want your organization to be referenced on the Authentik web UI.
  organization_name = "REPLACE_ME"

  // Should be the root domain on which the Authentik subdomain is hosted.
  // Example: "panfactum.com" if Authentik is hosted at "authentik.panfactum.com"
  organization_domain = "REPLACE_ME"

  // Optional: logo_svg_b64 = filebase64("${get_terragrunt_dir()}/logo.svg")

  // Controls whether members of the `superusers` group require hardware tokens such as Yubikeys (https://www.yubico.com/)
  // to authenticate. We *strongly* recommend setting this to `true`.
  superusers_require_webauthn = false
}
