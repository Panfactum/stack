
locals {
  rule_use_panfactum_scheduler = var.panfactum_scheduler_enabled ? [
    {
      name  = "use-panfactum-scheduler"
      match = local.match_any_pod_create

      // Don't use the panfactum scheduler if the pod explicitly opts out
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

      context = [
        {
          name = "schedulerCount"
          globalReference = {
            name     = "scheduler-pods"
            jmesPath = "items | length(@)"
          }
        }
      ]

      // Don't use the panfactum scheduler if no scheduler pods are running
      preconditions = {
        all = [
          {
            key      = "{{ schedulerCount }}"
            operator = "GreaterThan"
            value    = "0"
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

resource "kubectl_manifest" "scheduler_global_context" {
  count = var.panfactum_scheduler_enabled ? 1 : 0

  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2alpha1"
    kind       = "GlobalContextEntry"
    metadata = {
      name   = "scheduler-pods"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      apiCall = {
        urlPath         = "/api/v1/namespaces/scheduler/pods?fieldSelector=status.phase=Running"
        refreshInterval = "60s"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
}