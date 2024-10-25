locals {
  default_tolerations = compact([
    var.default_arm64_toleration_enabled ? "arm64" : null,
    var.default_spot_toleration_enabled ? "spot" : null,
    var.default_burstable_toleration_enabled ? "burstable" : null,
    var.default_controller_toleration_enabled ? "controller" : null
  ])


  rule_add_default_tolerations = [for toleration in local.default_tolerations :
    {
      name  = "add-${toleration}-toleration"
      match = local.match_any_pod_create
      exclude = {
        any = [
          {
            resources = {
              selector = {
                matchLabels = {
                  "panfactum.com/${toleration}-enabled" = "false"
                }
              }
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
    }
  ]

  // If the controller nodes are tolerated,
  // other tolerations need to be added (arm64, etc.) if they haven't already
  rule_add_extra_tolerations_if_controller_toleration = [for toleration in ["arm64", "spot", "burstable"] :
    {
      name  = "add-${toleration}-toleration-if-controller-toleration"
      match = local.match_any_pod_create
      preconditions = {
        all = [
          {
            key      = "controller"
            operator = "AnyIn"
            value    = "{{ request.object.spec.tolerations[].key || `[]` }}"
          },
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
    }
  ]

  // If the burstable nodes are tolerated,
  // other tolerations need to be added (spot) if they haven't already
  rule_add_extra_tolerations_if_burstable_toleration = [for toleration in ["spot"] :
    {
      name  = "add-${toleration}-toleration-if-burstable-toleration"
      match = local.match_any_pod_create
      preconditions = {
        all = [
          {
            key      = "burstable"
            operator = "AnyIn"
            value    = "{{ request.object.spec.tolerations[].key || `[]` }}"
          },
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
    }
  ]
}