---
layout: '@/layouts/DocumentationLayout.astro'
title: 'wf_spec'
---

# Argo Workflow Specification

> testing

The primary purpose of this submodule is to create a Workflow spec (`workflow_spec` output) that ensures compatibility
with the Panfactum deployment of Argo Workflows (deployed via [kube_argo](/docs/edge/reference/infrastructure-modules/direct/kubernetes/kube_argo))
and applies sensible defaults for usage in the overall Panfactum Stack.

In particular, this module takes care of the following:

- Assigns AWS permissions to the Workflow's ServiceAccount that allows the Workflow's templates to store
  artifacts and logs in S3.
- Assigns the necessary Kubernetes permissions to the Workflow's ServiceAccount that allows the Workflow to launch
  and record its status with the Argo Workflow controller.
- Sets up basic Workflow parallelism, timeouts, and retry configurations
- Assigns defaults for pods created by the Workflow (affinities, tolerations, volumes, security context, scheduler, etc.)
- Provides recommended container defaults (`container_defaults` output)
- Disables pod disruptions (overridable)

However, the core Workflow logic (defined via `templates`, `arguments`, and `entrypoint`) is left completely
up to the user to define. For more information on the available values for these fields, see the official
Argo documentation:

- [Template](https://argo-workflows.readthedocs.io/en/latest/fields/#template)
- [Arguments](https://argo-workflows.readthedocs.io/en/latest/fields/#arguments)

## Usage

For a basic introduction of how to use this module, see our [guide on creating Workflows](/docs/edge/guides/addons/workflow-engine/creating-workflows).

Below we cover some more advanced patterns that you will likely find useful when working with Workflows in the Panfactum Stack.

### Defining the Workflow DAG

Workflows are most useful when you need to define a multistep operation. Argo Workflows provides several means
to do this, but we recommend the following for almost all use cases:

- [DAG Templates](https://argo-workflows.readthedocs.io/en/latest/walk-through/dag/): For defining the execution graph across multiple other templates
- [ContainerSet Template](https://argo-workflows.readthedocs.io/en/latest/container-set-template/): For defining an execution graph inside a _single_ pod

ContainerSets can be run faster as all steps will share the same execution context and can share disk space. However,
they have a couple drawbacks:

- All containers in the ContainerSet will consume Kubernetes resources (CPU and memory requests) [even when they are not running](https://argo-workflows.readthedocs.io/en/latest/container-set-template/#resource-requests).
- They can only be used to orchestrate containers and not other types of templates.

DAGs offer the most flexibility as they can define a graph of _any_ set of templates, but every template in the execution graph will require creating its own Pod.
Generally, this isn't an issue, but it does add some additional time (to create each pod) and can cause issues when trying to share large amounts of data between steps.

If you do need to share large amounts of data between pods in a DAG, you can use the
`volume_mounts` module input to create a temporary PVC that will be mounted to each pod. However, you will need to take
care to ensure that only one Pod is running at once as a PVC can only be mounted to a single pod at once.

### Overriding the Template Defaults

When using the `wf_spec` module, all templates will be provided a default configuration based on the module
inputs. For example, if you provide `config_map_mounts`, all pods in the workflow will have a `volumes` configured
to include the specified ConfigMaps.

Occasionally, you may want to override the defaults for a given template. This can be done by explicitly
providing the relevant parameter to the template:

```hcl
module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update

  # By default, all pods will have this ConfigMap included as a volume
  config_map_mounts = {
    my-config-map = {
      mount_path = "/tmp/my-config-map"
    }
  }

  templates = [
    {
      volumes   = [] # This overrides the default and ensures that the pod for this template will have no volumes
      container = {
        image   = "some-repo/some-image:some-tag"
        command = [ "/bin/some-command" ]
        volumeMounts = [] # Since the pod has no volumes, the container cannot have any volume mounts either
      }
    }
  ]
}
```

Critically, all overrides are **shallow-merged by key**. This makes it possible to drop defaults (as in the example above),
but if you wanted to _add_ a new volume, you would need to explicitly concatenate to the original defaults.

```hcl
module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
  templates = [
    {
      volumes   = concat(
        module.workflow_spec.volumes, # The default volumes (note the self-reference)
        [{...}] # The new volume configurations to add
      )
    }
  ]
}
```

Note that OpenTofu supports self-references (i.e., using a module's outputs as a part of its inputs) since values
are lazily evaluated. As a result, we have given the `wf_spec` module outputs such as `tolerations`, `volumes`, `env`, etc.,
that can be used as building blocks for overrides.

### Parameterizing Workflows and Templates

Often you will want to supply inputs to workflows so to adjust how they behave. Argo calls
inputs "parameters" and provides documentation on this functionality [here](https://argo-workflows.readthedocs.io/en/latest/walk-through/parameters/). [^1]

[^1]:
    Technically, there are two types of inputs: parameters (values) and artifacts (files), but we will
    just focus on parameters in this section.

Note that _both_ Workflows as a whole _and_ their individual templates can be parameterized
although the syntax is slightly different. A Workflow has `arguments` and a template has `inputs`:

```hcl
module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update

  # These will show up in the the Argo web UI and you can pass them in when
  # creating a Workflow from a WorkflowTemplate programmatically
  arguments = {
    parameters = [
      {
        name = "workflow-foo"
        description = "Some input"
        default = "bar"
      }
    ]
  }

  entrypoint = "dag"
  templates = [
    {
      name        = "first"
      inputs = {
        parameters = [
          {
            name = "baz"
          }
        ]
      }
      container   = {
        image   = "some-repo/some-image:some-tag"
        command = [
          "/bin/some-command",
          "{{workflow.parameters.foo}}", # Will be replaced at execution time with Workflow-level parameter
          "{{inputs.parameters.baz}}" # Will be replaced at execution time with Template-level input
        ]
      }
    },
    {
      name = "build-image",
      dag = {
        tasks = [
          # Executes the "first" template and passes in "42" for the "baz" input
          {
            name = "first"
            template = "first"
            arguments = {
              parameters = [{
                name = "baz"
                value = "42"
              }]
            }
          }
        ]
      }
    }
  ]
}
```

Oftentimes, you may want to set the _same_ parameters on a Workflow and each of its
templates _and_ automatically pass through the values. We provide a convenience
utility to do this via the `passthrough_parameters` input.

For example:

```hcl
module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
  passthrough_parameters = [
    {
      name = "foo"
      description = "Some input"
      default = "bar"
    }
  ]

  entrypoint = "dag"
  templates = [
    {
      name        = "first"
      container   = {
        image   = "some-repo/some-image:some-tag"
        command = [
          "/bin/some-command",
          "{{inputs.parameters.foo}}"
        ]
      }
    },
    {
      name = "dag",
      dag = {
        tasks = [
          {
            name = "first"
            template = "first"
          }
        ]
      }
    }
  ]
}
```

is equivalent to

```hcl
module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
  arguments = {
    parameters = [
      {
        name = "foo"
        description = "Some input"
        default = "bar"
      }
    ]
  }

  entrypoint = "dag"
  templates = [
    {
      name        = "first"
      inputs = {
        parameters = [
          {
            name = "foo"
            default = "{{workflow.parameters.foo}}"
          }
        ]
      }
      container   = {
        image   = "some-repo/some-image:some-tag"
        command = [
          "/bin/some-command",
          "{{inputs.parameters.foo}}"
        ]
      }
    },
    {
      name = "dag",
      inputs = {
        parameters = [
          {
            name = "foo"
            default = "{{workflow.parameters.foo}}"
          }
        ]
      },
      dag = {
        tasks = [
          {
            name = "first"
            template = "first"
            arguments = {
              parameters =  [
                {
                  name = "foo"
                  value = "{{inputs.parameters.foo}}"
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

This can be helpful when you aim to reference a template defined on one Workflow from a completely separate Workflow
as described [here](/docs/edge/guides/addons/workflow-engine/triggering-workflows#from-other-workflows). This ensures
that regardless of how a template is executed, it will have the same parameterization capabilities.

### Conditional DAG Nodes (Tasks)

When using a DAG Template, you can conditionally execute certain nodes by replaces the `dependencies` field for a particular
task with a `depends` field that allows [enhanced depends logic](https://argo-workflows.readthedocs.io/en/latest/enhanced-depends-logic/).

We recommend using this pattern instead of `coninueOn` or
[Lifecycle hooks](https://argo-workflows.readthedocs.io/en/latest/lifecyclehook/#notification-use-case) as it is more
powerful and less error-prone.

### Retries and Timeouts

By default, Workflows created by the `wf_spec` module will automatically retry template execution on failure. You can tune
the behavior by adjusting the following inputs:

- `retry_backoff_initial_duration_seconds`
- `retry_backoff_max_duration_seconds`
- `retry_max_attempts` (set to `0` to disable retries)
- `retry_expression`
- `retry_policy`

Retries are done on a **per-template** basis and the above inputs set the default behavior for each
template; the entire Workflow will never retry.

Additionally, you can set a timeout for the entire workflow by tuning the `active_deadline_seconds`.

Individual templates can also have timeouts by setting the `activeDeadlineSeconds` field in each template. However,
note that the template-level timeout is **reset on every retry.**

### Concurrency Controls

There are three different levels of concurrency controls that you can use:

- `pod_parallelism`: If set, limits how many pods in a single Workflow instance that can be running at once.
- `workflow_parallelism`: Number of instances of this Workflow that can be running at once. See [mutexes and semaphores for Workflows](https://argo-workflows.readthedocs.io/en/latest/synchronization/#template-level-synchronization)
  for more information.
- [Template-level mutexes and semaphores](https://argo-workflows.readthedocs.io/en/latest/synchronization/#template-level-synchronization):
  Allows blocking individual templates from running.
  Can use the same mutex / semaphore across many workflows. Useful for locking access to certain resources (e.g., deploying to an environment).

### Saving and Loading Artifacts

Argo Workflows has a feature called [Artifacts](https://argo-workflows.readthedocs.io/en/latest/walk-through/artifacts/) for saving files
and directories across template executions.

We already set up the default artifact behavior to save artifacts to S3, so you do not need to do any setup to begin
immediately using artifacts in your Workflows.

### Adding Additional AWS Permissions

Each pod that gets created in the Workflow will run with the same ServiceAccount by default. This ServiceAccount
will be assigned AWS permissions via [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).

You can assign additional permissions to the ServiceAccount's IAM Role via the `extra_aws_permissions` input:

```hcl
data "aws_iam_policy_document" "permissions" {
  statement {
    sid       = "Admin"
    effect    = "Allow"
    actions   = ["*"] # Replace with your desired actions
    resources = ["*"] # Replace with your desired permissions
  }
}

module "workflow_spec" {
  source  = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update

  extra_aws_permissions = data.aws_iam_policy_document.permissions.json
}
```

### Adding Additional Kubernetes Permissions

Each pod that gets created in the Workflow will run with the same ServiceAccount by default. This ServiceAccount
can be assigned additional Kubernetes permissions by leveraging the `service_account_name` output:

```hcl
# Can use Role instead, if desired
resource "kubernetes_cluster_role_binding" "permissions" {
  metadata {
    generate_name = "extra-permissions"
    labels        = module.workflow_spec.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.workflow_spec.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"    # Replace with your desired ClusterRole
  }
}

module "workflow_spec" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
}
```

### Using the Panfactum devShell

We make the Panfactum devShell available as a container image that can be run in a
workflow. The specific image tag that is compatible with your version of the Panfactum stack can be sourced from the outputs of the
[kube_constants](/docs/edge/reference/infrastructure-modules/submodule/kubernetes/kube_constants) submodule. The below code
snippet shows an example:

```hcl
module "constants" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/kube_constants?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
}

module "pull_through" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/aws_ecr_pull_through_cache_addresses?ref=__PANFACTUM_VERSION_EDGE__" # pf-update
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "example_wf" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update

  name                    = "example"
  namespace               = var.namespace
  eks_cluster_name        = var.eks_cluster_name

  entrypoint = "example"
  templates = [
    {
      name    = "example"
      container = {
        image = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}:${module.constants.panfactum_image_version}"
        command = ["/some-command-here"]
      }
    }
  ]

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
```

### Adding Custom Scripts

You do not need to build a new container image to create and run custom scripts as long as you have an image
with a shell installed. Instead, you can mount scripts directly from your IaC.

This can make it much faster to quickly iterate on workflow logic.

The below snippet shows an example of mounting and running a custom script on top of the Panfactum devShell:

```hcl
# Attach the scripts to a ConfigMap so we can mount them in the workflow spec
resource "kubernetes_config_map" "wf_scripts" {
  metadata {
    name      = "example-scripts"
    namespace = var.namespace
  }
  data = {
    "example.sh" = file("${path.module}/example.sh") # This assumes you have an "example.sh" script file in this module
  }
}

module "example_wf" {
  source = "github.com/Panfactum/stack.git//packages/infrastructure/wf_spec?ref=__PANFACTUM_VERSION_EDGE__" # pf-update

  name                    = "example"
  namespace               = var.namespace
  eks_cluster_name        = var.eks_cluster_name

  entrypoint = "example"
  templates = [
    {
      name    = "example"
      container = {
        image = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}:${module.constants.panfactum_image_version}"
        command = ["/scripts/example.sh"] # Execute the mounted script
      }
    }
  ]
  # This will mount the ConfigMap at mount_path inside each container; all the keys of the ConfigMap are file names and the values
  # are the file contents.
  config_map_mounts = {
    "${kubernetes_config_map.wf_scripts.metadata[0].name}" = {
      mount_path = "/scripts"
    }
  }

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
```

### Retaining Workflows and Workflow Pods

When a Workflow completes, it isn't automatically deleted. It is still

Workflow objects will be automatically deleted from the Kubernetes cluster based on the following inputs:

- `workflow_delete_seconds_after_completion`
- `workflow_delete_seconds_after_failure`
- `workflow_delete_seconds_after_success`

When a Workflow is deleted, all the other Kubernetes objects that it owns are also deleted (e.g., Pods, Artifacts, etc.).

If you want to delete pods earlier, you can set `pod_delete_delay_seconds` to some lower value; however, pods can never
outlive the Workflow.

### Composing Workflows

A common pattern is to compose multiple smaller Workflows into a larger Workflow. We provide
guidance on implementing that pattern
[here](/docs/edge/guides/addons/workflow-engine/triggering-workflows#from-other-workflows).

## Providers

The following providers are needed by this module:

- [kubectl](https://registry.terraform.io/providers/alekc/kubectl/2.0.4/docs) (2.0.4)

- [kubernetes](https://registry.terraform.io/providers/hashicorp/kubernetes/2.27.0/docs) (2.27.0)

- [pf](https://registry.terraform.io/providers/panfactum/pf/0.0.3/docs) (0.0.3)

- [random](https://registry.terraform.io/providers/hashicorp/random/3.6.0/docs) (3.6.0)

## Required Inputs

The following input variables are required:

### eks_cluster_name

Description: The name of the EKS cluster that contains the service account.

Type: `string`

### entrypoint

Description: Name of the template that will be used as the first node in this workflow

Type: `string`

### name

Description: The name of this Workflow

Type: `string`

### namespace

Description: The namespace the cluster is in

Type: `string`

### templates

Description: A list of workflow templates. See [https://argo-workflows.readthedocs.io/en/stable/fields/#template](https://argo-workflows.readthedocs.io/en/stable/fields/#template).

Type: `any`

## Optional Inputs

The following input variables are optional (have default values):

### active_deadline_seconds

Description: Duration in seconds relative to the workflow start time which the workflow is allowed to run before the controller terminates the Workflow

Type: `number`

Default: `86400`

### archive_logs_enabled

Description: Whether logs should be archived and made available in the Argo web UI

Type: `bool`

Default: `true`

### arguments

Description: The arguments to set for the Workflow

Type:

```hcl
object({
    artifacts  = optional(list(any), [])
    parameters = optional(list(any), [])
  })
```

Default:

```json
{
  "artifacts": [],
  "parameters": []
}
```

### arm_nodes_enabled

Description: Whether to allow Pods to schedule on arm64 nodes

Type: `bool`

Default: `true`

### burstable_nodes_enabled

Description: Whether to allow Pods to schedule on burstable nodes

Type: `bool`

Default: `false`

### cluster_workflow_template_ref

Description: Name is the resource name of the ClusterWorkflowTemplate template ([https://argo-workflows.readthedocs.io/en/stable/cluster-workflow-templates/](https://argo-workflows.readthedocs.io/en/stable/cluster-workflow-templates/))

Type: `string`

Default: `null`

### common_env

Description: Key pair values of the environment variables for each container

Type: `map(string)`

Default: `{}`

### common_env_from_config_maps

Description: Environment variables that are sourced from existing Kubernetes ConfigMaps. The keys are the environment variables names and the values are the ConfigMap references.

Type:

```hcl
map(object({
    config_map_name = string
    key             = string
  }))
```

Default: `{}`

### common_env_from_secrets

Description: Environment variables that are sourced from existing Kubernetes Secrets. The keys are the environment variables names and the values are the Secret references.

Type:

```hcl
map(object({
    secret_name = string
    key         = string
  }))
```

Default: `{}`

### common_secrets

Description: Key pair values of secrets to add to the containers as environment variables

Type: `map(string)`

Default: `{}`

### config_map_mounts

Description: A mapping of ConfigMap names to their mount configuration in the containers of the Workflow

Type:

```hcl
map(object({
    mount_path = string                # Where in the containers to mount the ConfigMap
    optional   = optional(bool, false) # Whether the Pod can launch if this ConfigMap does not exist
  }))
```

Default: `{}`

### controller_node_required

Description: Whether the Pods must be scheduled on a controller node

Type: `bool`

Default: `false`

### default_container_image

Description: The default container image to use

Type: `string`

Default: `"docker.io/library/busybox:1.36.1"`

### default_resources

Description: The default container resources to use

Type:

```hcl
object({
    requests = optional(object({
      memory = optional(string, "100Mi")
      cpu    = optional(string, "50m")
    }), { memory = "100Mi", cpu = "50m" })
    limits = optional(object({
      memory = optional(string, "100Mi")
      cpu    = optional(string, null)
    }), { memory = "100Mi" })
  })
```

Default:

```json
{
  "limits": {
    "memory": "100Mi"
  },
  "requests": {
    "cpu": "50m",
    "memory": "100Mi"
  }
}
```

### delete_artifacts_on_deletion

Description: Change the default behavior to delete artifacts on workflow deletion

Type: `bool`

Default: `false`

### disruptions_enabled

Description: Whether disruptions should be enabled for Pods in the Workflow

Type: `bool`

Default: `false`

### dns_policy

Description: The DNS policy for the Pods

Type: `string`

Default: `"ClusterFirst"`

### extra_aws_permissions

Description: Extra JSON-encoded AWS permissions to assign to the Workflow's service account

Type: `string`

Default: `"{}"`

### extra_labels

Description: Extra labels to assign to all resources in this workflow

Type: `map(string)`

Default: `{}`

### extra_pod_annotations

Description: Annotations to add to the Pods in the Workflow

Type: `map(string)`

Default: `{}`

### extra_pod_labels

Description: Extra Pod labels to use

Type: `map(string)`

Default: `{}`

### extra_tolerations

Description: Extra tolerations to add to the Pods

Type:

```hcl
list(object({
    key      = optional(string)
    operator = string
    value    = optional(string)
    effect   = optional(string)
  }))
```

Default: `[]`

### extra_workflow_labels

Description: Extra labels to add to the Workflow object

Type: `map(string)`

Default: `{}`

### hooks

Description: Hooks to add to the Workflow

Type: `any`

Default: `{}`

### ip_allow_list

Description: A list of IPs that can use the service account token to authenticate with AWS API

Type: `list(string)`

Default: `[]`

### linux_capabilities

Description: Extra linux capabilities to add to containers by default

Type: `list(string)`

Default: `[]`

### mount_owner

Description: The ID of the group that owns the mounted volumes

Type: `number`

Default: `1000`

### node_preferences

Description: Node label preferences for the Pods

Type: `map(object({ weight = number, operator = string, values = list(string) }))`

Default: `{}`

### node_requirements

Description: Node label requirements for the Pods

Type: `map(list(string))`

Default: `{}`

### on_exit

Description: A template reference which is invoked at the end of the workflow, irrespective of the success, failure, or error of the primary template.

Type: `string`

Default: `null`

### panfactum_scheduler_enabled

Description: Whether to use the Panfactum Pod scheduler with enhanced bin-packing

Type: `bool`

Default: `true`

### passthrough_parameters

Description: Workflow paramaters that should automatically passthrough to every template on the workflow

Type:

```hcl
list(object({
    default     = optional(string)
    description = optional(string)
    enum        = optional(list(string))
    globalName  = optional(string)
    name        = string
    value       = optional(string)
  }))
```

Default: `[]`

### pod_delete_delay_seconds

Description: The number of seconds after Workflow completion that Pods will be deleted

Type: `number`

Default: `180`

### pod_parallelism

Description: Limits the max total parallel pods that can execute at the same time in a workflow

Type: `number`

Default: `null`

### priority

Description: Priority is used if controller is configured to process limited number of workflows in parallel. Workflows with higher priority are processed first.

Type: `number`

Default: `null`

### priority_class_name

Description: The default priority class to use for Pods in the Workflow

Type: `string`

Default: `null`

### privileged

Description: Whether the generated containers run with elevated privileges

Type: `bool`

Default: `false`

### pull_through_cache_enabled

Description: Whether to use the ECR pull through cache for the deployed images

Type: `bool`

Default: `true`

### read_only

Description: Whether the generated containers default to read-only root filesystems

Type: `bool`

Default: `true`

### retry_backoff_initial_duration_seconds

Description: The initial number of seconds to wait before the next retry in an exponential backoff strategy

Type: `number`

Default: `30`

### retry_backoff_max_duration_seconds

Description: The maximum number of seconds to wait before the next retry in an exponential backoff strategy

Type: `number`

Default: `3600`

### retry_expression

Description: Expression is a condition expression for when a node will be retried. If it evaluates to false, the node will not be retried and the retry strategy will be ignored.

Type: `string`

Default: `null`

### retry_max_attempts

Description: The maximum number of allowable retries

Type: `number`

Default: `5`

### retry_policy

Description: The policy that determines when the Workflow will be retried

Type: `string`

Default: `"Always"`

### run_as_root

Description: Whether to enable running as root in the Pods

Type: `bool`

Default: `false`

### secret_mounts

Description: A mapping of Secret names to their mount configuration in the containers of the Workflow

Type:

```hcl
map(object({
    mount_path = string                # Where in the containers to mount the Secret
    optional   = optional(bool, false) # Whether the Pod can launch if this Secret does not exist
  }))
```

Default: `{}`

### spot_nodes_enabled

Description: Whether to allow Pods to schedule on spot nodes

Type: `bool`

Default: `true`

### suspend

Description: Whether this workflow is suspended

Type: `bool`

Default: `false`

### tmp_directories

Description: A mapping of temporary directory names (arbitrary) to their configuration

Type:

```hcl
map(object({
    mount_path = string                # Where in the containers to mount the temporary directories
    size_mb    = optional(number, 100) # The number of MB to allocate for the directory
    node_local = optional(bool, false) # If true, the temporary storage will come from the host node rather than a PVC
  }))
```

Default: `{}`

### uid

Description: The UID to use for the user in the Pods

Type: `number`

Default: `1000`

### volume_mounts

Description: A mapping of names to configuration for temporary PersistentVolumeClaims used by all Pods in the Workflow

Type:

```hcl
map(object({
    storage_class = optional(string, "ebs-standard")
    access_modes  = optional(list(string), ["ReadWriteOnce"])
    size_gb       = optional(number, 1) # The size of the volume in GB
    mount_path    = string              # Where in the containers to mount the volume
  }))
```

Default: `{}`

### workflow_annotations

Description: Annotations to add to the Workflow object

Type: `map(string)`

Default: `{}`

### workflow_delete_seconds_after_completion

Description: The number of seconds after workflow completion that the Workflow object will be deleted

Type: `number`

Default: `3600`

### workflow_delete_seconds_after_failure

Description: The number of seconds after workflow failure that the Workflow object will be deleted

Type: `number`

Default: `3600`

### workflow_delete_seconds_after_success

Description: The number of seconds after workflow success that the Workflow object will be deleted

Type: `number`

Default: `3600`

### workflow_parallelism

Description: Number of concurrent instances of this Workflow allowed to be running at any given time

Type: `number`

Default: `1`

## Outputs

The following outputs are exported:

### affinity

Description: The affinity added to each Pod by default

### arguments

Description: The arguments to the workflow

### aws_role_arn

Description: The name of the AWS role used by the Workflow's Service Account

### aws_role_name

Description: The name of the AWS role used by the Workflow's Service Account

### container_defaults

Description: Default options for every container spec

### container_security_context

Description: The security context to be applied to each container in each Pod generated by this Workflow

### env

Description: The environment variables to be added to each container in each Pod generated by this Workflow

### generate_name

Description: The prefix for generating Workflow names from this spec

### labels

Description: The default labels assigned to all resources in this Workflow

### match_labels

Description: The labels unique to this deployment that can be used to select the Pods in this Workflow

### name

Description: The non-prefix name of the Workflow spec (should be used for naming derived resources like WorkflowTemplates)

### service_account_name

Description: The default service account used for the Pods

### template_parameters

Description: The default parameters set on each template

### tolerations

Description: Tolerations added to each Pod by default

### volume_mounts

Description: The volume mounts to be applied to the main container in each Pod generated by this Workflow

### volumes

Description: The volume specification to be applied to all pods generated by this Workflow

### workflow_spec

Description: The specification for the Workflow

## Maintainer Notes

No notes

{/_ eslint-enable import/order _/}

{/_ lint enable no-duplicate-headings _/}
