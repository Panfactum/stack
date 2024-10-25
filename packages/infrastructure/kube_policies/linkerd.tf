locals {
  rule_linkerd = [
    // The sidecar proxy should always shutdown prior to the pod terminationGracePeriodSeconds elapsing;
    // otherwise, the pod will look "failed" to controllers like Argo. This can occur if the main pod
    // has a TCP connection leak that would otherwise be harmless
    {
      name  = "set-linkerd-shutdown-grace-period"
      match = local.match_any_pod_create
      context = [
        {
          name = "termSeconds"
          variable = {
            value    = "{{ subtract(`{{ request.object.spec.terminationGracePeriodSeconds }}`,`1`) }}"
            jmesPath = "to_string(@)" // This is necessary b/c otherwise this is interpreted as a number and causes pods to fail to launch
          }
        }
      ]
      mutate = {
        patchStrategicMerge = {
          metadata = {
            annotations = {
              "+(config.linkerd.io/shutdown-grace-period)" = "{{ termSeconds }}"
            }
          }
        }
      }
    }
  ]
}