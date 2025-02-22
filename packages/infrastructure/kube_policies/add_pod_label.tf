
locals {
  rule_add_pod_label = [
    {
      name  = "add-pod-label"
      match = local.match_any_pod_create
      mutate = {
        patchStrategicMerge = {
          metadata = {
            labels = merge(
              {
                "+(panfactum.com/kyverno-mutated)" = "true"
              },
              {
                for k, v in var.common_pod_labels : "+(${k})" => v
              }
            )
            annotations = { for k, v in var.common_pod_annotations : "+(${k})" => v }
          }
        }
      }
    }
  ]
}