
locals {
  // This rule MUST be a global rule as the annotation must be present on the pod BEFORE reaching
  // the linkerd proxy injector
  rule_disable_linkerd = [
    // This rule disables the linkerd sidecar injection
    // if the linkerd control plane is down
    {
      name  = "disable-linkerd"
      match = local.match_any_pod_create
      context = [
        {
          name = "destination"
          globalReference = {
            name     = "linkerd-destination-count"
            jmesPath = "items | length(@)"
          }
        },
        {
          name = "identity"
          globalReference = {
            name     = "linkerd-identity-count"
            jmesPath = "items | length(@)"
          }
        }
      ]
      preconditions = {
        any = [
          {
            key      = "{{ destination }}"
            operator = "LessThan"
            value    = "1"
          },
          {
            key      = "{{ identity }}"
            operator = "LessThan"
            value    = "1"
          }
        ]
      }
      mutate = {
        patchStrategicMerge = {
          metadata = {
            annotations = {
              "linkerd.io/inject" = "disabled"
            }
          }
        }
      }
    }
  ]
}

resource "kubectl_manifest" "linkerd_identity_global_context" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2alpha1"
    kind       = "GlobalContextEntry"
    metadata = {
      name   = "linkerd-identity-count"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      apiCall = {
        urlPath         = "/api/v1/namespaces/linkerd/pods?fieldSelector=status.phase=Running&labelSelector=linkerd.io/control-plane-component=identity"
        refreshInterval = "60s"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "linkerd_destination_global_context" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v2alpha1"
    kind       = "GlobalContextEntry"
    metadata = {
      name   = "linkerd-destination-count"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      apiCall = {
        urlPath         = "/api/v1/namespaces/linkerd/pods?fieldSelector=status.phase=Running&labelSelector=linkerd.io/control-plane-component=destination"
        refreshInterval = "60s"
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
}