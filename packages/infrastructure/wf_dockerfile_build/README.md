# Argo Workflow Template: Dockerfile Build Deployment

import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

<MarkdownAlert severity="warning">
    This module will only run inside of clusters that have the [kube_buildkit](/docs/main/guides/addons/buildkit/installing) addon deployed.
</MarkdownAlert>

This module creates an Argo [WorkflowTemplate](https://argo-workflows.readthedocs.io/en/latest/workflow-templates/)
that will use BuildKit to build a Dockerfile from an indicated code repository and push it to
the account's ECR registry.

In particular, generated Workflows will perform the following actions:

- Check out the source code indicated by `code_repo` using our [standard checkout process](/docs/main/guides/cicd/checking-out-code).
- Automatically configure authentication with the ECR registry for the account where the Workflow runs.
- Scale-up the cluster's BuildKit instances if needed.
- Submit both arm64 and amd64 builds to BuildKit using the indicated `dockerfile_path` and `build_context` (paths
  relative to the root of `code_repo`) with the build-time arguments and secrets provided by `secrets` and
  `args`, respectively.
- Merge the generated images into a [multi-platform image](https://docs.docker.com/build/building/multi-platform/) and push
  the result to the ECR repository indicated by `image_repo` with the image tag set to the git commit hash of the code
  that was checked out from `code_repo`.

## Arguments for Generated Workflows

| Parameter      | Default            | Order | Description                                                                                                                                  |
|----------------|--------------------|-------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `git_ref`      | `var.git_ref`      | 0     | The [git reference](https://git-scm.com/book/en/v2/Git-Internals-Git-References) to use when checking out the `var.code_repo` for the build. |

## Usage

We provide an example of using this module [here](https://github.com/Panfactum/stack/blob/__PANFACTUM_VERSION_MAIN__/packages/reference/infrastructure/demo_cicd/website_image_builder.tf).

The critical configuration values are:

- `code_repo`: The repository containing your Dockerfile and code to build.
- `dockerfile_path`: (Optional) A relative path from the root of the repo to your Dockerfile (or Containerfile).
- `build_context`: (Optional) The [build context](https://docs.docker.com/build/building/context/) to submit to BuildKit.
- `args`: (Optional) The [build arguments](https://docs.docker.com/build/guide/build-args/) to set.
- `secrets`: (Optional) The [build secrets](https://docs.docker.com/build/building/secrets/) to set.

<MarkdownAlert severity="info">
    Make sure you review [our guide](/docs/main/guides/addons/buildkit/building-images) on how to optimize your Dockerfiles and build processes.
</MarkdownAlert>

### Authenticating with Private Code Repositories

`git_username` and `git_password` can be used for authenticating with a private `code_repo`. See our [documentation](/docs/main/guides/cicd/checking-out-code)
for what values to provide. The only permissions needed by this Workflow is read access to the source code.

### Using Private Base Images

If your Dockerfile sources images from a private ECR repository such as this:

```Dockerfile
FROM xxxxxxxxx.dkr.ecr.us-west-2.amazonaws.com/some-image:latest
RUN /foo/bar
```

then you will need to grant this Workflow permissions to pull from those repositories. To do that,
provide the ECR repository ARNs to the `extra_ecr_repo_arns_for_pull_access` input.

Note that if any provided ECR repository is in a separate AWS account from this Workflow, you 
must also follow [this guide.](https://repost.aws/knowledge-center/secondary-account-access-ecr)

### Build Instance Sizing

The containers running in this workflow only perform very basic orchestration operations. The build processes
actually occur directly in the BuildKit instances.

If you are finding you need to increase the resource requests or limits for your build processes, you
will need to adjust the parameters of the [kube_buildkit](/docs/main/reference/infrastructure-modules/direct/kubernetes/kube_buildkit) module.

