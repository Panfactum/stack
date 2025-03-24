// Deletes released persistentvolumes after a specified number of days
resource "kubectl_manifest" "released_pv_gc" {
  count = var.gc_released_volumes_after_days > -1 ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2"
    kind       = "ClusterCleanupPolicy"
    metadata = {
      name   = "released-pv-gc"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      match = {
        any = [{
          resources = {
            kinds = ["PersistentVolume"]
          }
        }]
      }
      conditions = {
        all = [
          {
            key      = "{{ target.status.phase }}"
            operator = "Equals"
            value    = "Released"
          },
          {
            key      = "{{ time_since('', '{{ target.status.lastPhaseTransitionTime }}', '') }}"
            operator = "GreaterThan"
            value    = "${var.gc_released_volumes_after_days * 24}h0m0s"
          }
        ]
      }
      schedule = "* * * * *"
    }
  })
  force_conflicts   = true
  server_side_apply = true
}