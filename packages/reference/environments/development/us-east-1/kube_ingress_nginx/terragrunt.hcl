include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cert_issuers" {
  config_path  = "../kube_cert_issuers"
  skip_outputs = true
}

dependency "lb_controller" {
  config_path  = "../kube_aws_lb_controller"
  skip_outputs = true
}

inputs = {
  ingress_domains = [
    "seth.panfactum.com"
  ]
  dhparam                 = <<EOT
-----BEGIN DH PARAMETERS-----
MIICDAKCAgEA0iVgazhJIwEzf8eBNszlW5GJsmLDAl05uW+UfYBSrICZSSrI+cZS
zHSSCzEy2YNmHXYN9/earn+I7spbwT/k8xCWfQRiycd2UL79/RmM7KT/zpPNosZn
fjr/KKxKJ2oBoDozFpXAFtgNsQWnM4IiHdtcSSBU4ClzoUsBn7MbqK9u+oFZlXzp
T7MJnrbDxxrZnU4u8YYHr2q6K4yt13amZSUP94xfjp+GA0+xxJjUHGS+yW4eT26v
HK+67vI4drj15LFiS3IGCgfvVWy+Zhpo95B9fn1iJlgiZ+7R6OmfluoVL0YMGoDx
e5MrQ/AgzcDT2c2kFpXHCBHo0+Zem3ldUup6OrGF3spHanbgWlRhOG1ThQsolKVs
+YXAS9xHKqcG1WnDsLbyb5EBk3q94RReYoBPD+K47nZ6Ck9eB2RSLGFxGN0TDrPZ
9pfvIlW2/Z8n5G2/+RHHvaQEZz0ThQTOXPwNQXbrYtM8E58e0PkElzKE+K8H+Ejh
JZF5BTaaQijTVCcNXPfKvosKw4BYYUc/QQwj32RehZlRjdA3tPaXut1XVCSn0r8J
XGa+2CuIdhVTe0765/bfpcdvBrDJw7n5i8FSms9vKLXl7Q/xpKlZoH1JYTE4erlf
1e0n+vPBOMJcmF66vI/E4nbhvq8sI1HXe7VcrMz0nY2MuqccQ5ZXZmcCAQICAgFF
-----END DH PARAMETERS-----
EOT

  ingress_timeout_seconds = 60

  // Tune this as appropriate for your use case: https://panfactum.com/docs/edge/guides/deploying-workloads/high-availability
  sla_level = 1
}