// Deletes unprocessed update requests after 24 hours
resource "kubectl_manifest" "update_request_gc" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2"
    kind       = "ClusterCleanupPolicy"
    metadata = {
      name   = "update-request-gc"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      match = {
        any = [{
          resources = {
            kinds = ["kyverno.io/v2/UpdateRequest"]
          }
        }]
      }
      conditions = {
        all = [
          {
            key      = "{{ time_since('', '{{ target.metadata.creationTimestamp }}', '') }}"
            operator = "GreaterThan"
            value    = "24h0m0s"
          }
        ]
      }
      schedule = "15 * * * *"
    }
  })
  force_conflicts   = true
  server_side_apply = true
}