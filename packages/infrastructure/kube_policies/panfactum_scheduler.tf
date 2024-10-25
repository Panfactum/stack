
locals {
  rule_use_panfactum_scheduler = var.panfactum_scheduler_enabled ? [
    {
      name  = "use-panfactum-scheduler"
      match = local.match_any_pod_create
      exclude = {
        any = [
          {
            resources = {
              selector = {
                matchLabels = {
                  "panfactum.com/scheduler-enabled" = "false"
                }
              }
            }
          }
        ]
      }
      mutate = {
        patchStrategicMerge = {
          spec = {
            schedulerName = "panfactum"
          }
        }
      }
    }
  ] : [null]
}