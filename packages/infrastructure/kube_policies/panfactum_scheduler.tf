resource "kubectl_manifest" "panfactum_scheduler" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "use-panfactum-schduler"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [
        {
          name  = "update-schduler"
          match = local.match_any_pod
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
      ]
    }
  })

  force_conflicts   = true
  server_side_apply = true
}