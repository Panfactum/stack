# Argo Workflow Specification

The primary purpose of this submodule is to create a Workflow spec (`workflow_spec` output) that ensures compatibility
with the Panfactum deployment of Argo Workflows (deployed via [kube_argo](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_argo))
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

For a basic introduction of how to use this module, see our [guide on creating Workflows](/docs/main/guides/addons/workflow-engine/creating-workflows).

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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"
  
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

[^1]: Technically, there are two types of inputs: parameters (values) and artifacts (files), but we will
just focus on parameters in this section.

Note that *both* Workflows as a whole *and* their individual templates can be parameterized
although the syntax is slightly different. A Workflow has `arguments` and a template has `inputs`:

```hcl
module "workflow_spec" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

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

Oftentimes, you may want to set the *same* parameters on a Workflow and each of its
templates *and* automatically pass through the values. We provide a convenience
utility to do this via the `passthrough_parameters` input.

For example:

```hcl
module "workflow_spec" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"
  
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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"
  
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
as described [here](/docs/main/guides/addons/workflow-engine/triggering-workflows#from-other-workflows). This ensures
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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"
}
```

### Workflow Labels

In addition to the statically defined labels for the generated Workflows via `extra_workflow_labels`,
you can also specify dynamically generated labels.
This can be helpful for easily searching for workflows based on their runtime properties (e.g., parameter inputs).

We provide two means to do this:

- `labels_from_parameters`: Specify a list of parameters. Generated workflows will have labels added where the key is the parameter
name and the value is the parameter value.

- `labels_from`: Specify an arbitrary [labelsFrom](https://argo-workflows.readthedocs.io/en/latest/fields/#labelvaluefrom) configuration
for the generated Workflows. The configuration is merged with `labels_from_parameters`.


### Using the Panfactum devShell

We make the Panfactum devShell available as a container image that can be run in a
workflow. The specific image tag that is compatible with your version of the Panfactum stack can be sourced from the outputs of the
[kube_constants](/docs/main/reference/infrastructure-modules/submodule/kubernetes/kube_constants) submodule. The below code
snippet shows an example:

```hcl
module "constants" {
  source = "${var.pf_module_source}kube_constants${var.pf_module_ref}"
}

module "example_wf" {
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name                    = "example"
  namespace               = var.namespace
  eks_cluster_name        = var.eks_cluster_name

  entrypoint = "example"
  templates = [
    {
      name    = "example"
      container = {
        image = "${module.constants.images.devShell.registry}/${module.constants.images.devShell.repository}:${module.constants.images.devShell.tag}"
        command = ["/some-command-here"]
      }
    }
  ]
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
  source = "${var.pf_module_source}wf_spec${var.pf_module_ref}"

  name                    = "example"
  namespace               = var.namespace
  eks_cluster_name        = var.eks_cluster_name

  entrypoint = "example"
  templates = [
    {
      name    = "example"
      container = {
        image = "${module.constants.images.devShell.registry}/${module.constants.images.devShell.repository}:${module.constants.images.devShell.tag}"
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
[here](/docs/main/guides/addons/workflow-engine/triggering-workflows#from-other-workflows).


