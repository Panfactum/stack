# Argo Workflow Template: Tofu Deployment

import MarkdownAlert from "@/components/markdown/MarkdownAlert";

This module creates an Argo [WorkflowTemplate](https://argo-workflows.readthedocs.io/en/latest/workflow-templates/)
that will deploy Tofu code from an indicated repository that follows the Panfactum Stack IaC conventions.

In particular, generated Workflows will perform the following actions:

- Check out the source code indicated by `repo` using our [standard process](/docs/main/guides/cicd/checking-out-code).
- Automatically configure authentication for the following providers: AWS, Kubernetes, Vault
- Update SOPS-encrypted files to use the CI's AWS profile
- Configure the [Terragrunt provider cache](https://terragrunt.gruntwork.io/docs/features/provider-cache/).
- Run `terragrunt run-all apply` on the directory indicated by `tf_apply_dir`.
- Automatically retry several times in the case of transient failures and/or rate limits.
- Unlock the state backend in case of a runtime failure.

## Usage

We provide several examples of using this module [here](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure/demo_cicd/tf_deploy.tf).

The critical configuration values are:

- `repo`: The repository containing your configuration-as-code (i.e., `terragrunt.hcl` files)
- `tf_apply_dir`: A relative path from the root of the repo in which `terragrunt run-all apply` will be run. The generated 
  Workflow will apply all modules in this subdirectory.
- `git_ref`: The default [git reference](https://git-scm.com/book/en/v2/Git-Internals-Git-References) to use when checking
  out the `repo`. Can and should be overwritten when creating individual Workflows.

You can create as many instances of this module as you need. Usually you will have many different instances with different
values for `tf_apply_dir`.

<MarkdownAlert severity="warning">
    A single instance of this module can only be used for deploying modules **in a single region** as the implicit authentication
    for the IaC providers is scoped to an individual Kubernetes cluster.

    In other words, you cannot deploy this module in one Kubernetes cluster and have it read or update resources in a different cluster.

    This additionally applies to [Terragrunt dependencies.](https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependencies)
    For example, do not allow your modules to depend on modules in other environments.
</MarkdownAlert>


### Authenticating with Private Repositories

`git_username` and `git_password` can be used for authenticating with a private `repo`. See our [documentation](/docs/main/guides/cicd/checking-out-code)
for what values to provide. The only permissions needed by this Workflow is read access to the source code.

Note that these credentials will be used for _all_ git operations, so if your modules refer to many private repositories,
please ensure that the credentials have access to all systems.

### Provider Authentication

The following provider authz/n is automatically provided:

- Admin access to the AWS account in which the module is deployed.
- Admin access to the Kubernetes cluster in which the module is deployed.
- Admin access to the Vault instance running in the Kubernetes cluster in which the module is deployed.

If you need to provide additional authentication, most Tofu providers can be configured via environment variables.
You can add additional environment variables to the containers running Terragrunt via the `secrets` input object.
Object keys are the environment variable names, and values are the secret values.

### Resources

We limit the number of parallel module applications in this Workflow to 5. This ensures that the running containers
have predictable CPU and memory needs.

However, if you have very large modules or use providers not provided by Panfactum, you may need to increase the CPU
and memory settings to avoid problems like OOM errors. You can do this via the `memory_mb` and `cpu_millicores` inputs.

### Skipping Modules

Occasionally, you may develop modules that you do not want to deploy via a particular workflow or your CI/CD system
in general.

You can utilize the Terragrunt [skip](https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#skip)
attribute to skip over the deployment of certain modules in some circumstances.

For example, the below configuration settings in a `terragrunt.hcl` 
will prevent a given module from being deployed in a CI workflow (but still allow it to be applied locally):

```hcl
terraform {
  source = include.panfactum.locals.pf_stack_source
}

skip = include.panfactum.locals.is_ci
```

