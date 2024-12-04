locals {

  cilium_test_namespace = "cilium-test"

  // Note: this must be created in this module rather than kube_cilium as kube_cilium is installed
  // before Kyverno
  rule_cilium_test = flatten([

    // If the test pods are disrupted in the middle of the test,
    // the test will fail. This usually occurs when running the connectivity test
    // after completing the bootstrapping guide.
    {
      name = "prevent-cilium-test-pod-eviction"
      match = {
        any = [
          {
            resources = {
              kinds      = ["Pod"]
              namespaces = [local.cilium_test_namespace]
            }
          }
        ]
      }
      mutate = {
        patchStrategicMerge = {
          metadata = {
            labels = {
              "+(panfactum.com/descheduler-enabled)" = "false"
            }
            annotations = {
              "+(karpenter.sh/do-not-disrupt)" = "true"
            }
          }
        }
      }
    },

    // Linkerd will interfere with the network test so we prevent the test
    // pods from being included in the service mesh
    {
      name = "prevent-cilium-test-pod-linkerd-injection"
      match = {
        any = [
          {
            resources = {
              kinds      = ["Pod"]
              namespaces = [local.cilium_test_namespace]
            }
          }
        ]
      }
      mutate = {
        patchStrategicMerge = {
          metadata = {
            labels = {
              "+(linkerd.io/inject)" = "disabled"
            }
          }
        }
      }
    },

    // The test pods should tolerate all nodes
    [for toleration in ["burstable", "spot", "arm64", "controller"] : {
      name = "add-${toleration}-to-cilium-test-pod"
      match = {
        any = [
          {
            resources = {
              kinds      = ["Pod"]
              namespaces = [local.cilium_test_namespace]
              operations = ["CREATE"]
            }
          }
        ]
      }
      preconditions = {
        any = [
          {
            key      = toleration
            operator = "AnyNotIn"
            value    = "{{ request.object.spec.tolerations[].key || `[]` }}"
          }
        ]
      }
      mutate = {
        patchesJson6902 = yamlencode([
          {
            op   = "add"
            path = "/spec/tolerations/-"
            value = {
              key      = toleration
              operator = "Equal"
              value    = "true"
              effect   = "NoSchedule"
            }
          },
          {
            op    = "add",
            path  = "/metadata/labels/panfactum.com~1${toleration}-enabled"
            value = "true"
          }
        ])
      }
    }],

    // The Cilium test namespace does not get automatically deleted
    // so this performs the cleanup in case the user forgets
    {
      name = "delete-cilium-test-namepace"
      match = {
        any = [
          {
            resources = {
              kinds      = ["Namespace"]
              names      = [local.cilium_test_namespace]
              operations = ["CREATE"]
            }
          }
        ]
      }
      mutate = {
        mutateExistingOnPolicyUpdate = true
        targets = [{
          apiVersion = "v1"
          kind       = "Namespace"
          name       = local.cilium_test_namespace
        }]
        patchStrategicMerge = {
          metadata = {
            labels = {
              "+(cleanup.kyverno.io/ttl)" = "4h"
            }
          }
        }
      }
    }
  ])
}