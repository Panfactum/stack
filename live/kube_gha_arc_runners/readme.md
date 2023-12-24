# Kubernetes GHA ARC Runners

This module provides:
- deployments of ARC [runner scale sets](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller) that can be
targeted in GHA workflows to execute our CI/CD scripts

The runners come pre-equipped with the following:

- a configured environment using `devenv`
  through our custom container image found [here](../../../ci/README.md)
- permissions needed to execute changes to
  the infrastructure through dynamic credentials:
  - admin access to the containing cluster
  - admin access to the AWS account containing the cluster
  - admin access to the vault instance in the cluster
  - ownership over the AAD apps created in the environment

See the [vars file](./vars.tf) for descriptions of the input parameters.

## AAD Permissions

As our AAD tenant is a resource shared across all of
the environments, these environment-specific runners do
not have admin access to the tenant as that would provide
a means of root privilege escalation through runners in
lower environments.

As a result, there are a handful of manual steps required
to give the runners the right AAD permissions they need
to manage environment-specific AAD resources:

- This module must first be applied locally by a `Global Administrator`
  in order to assign the right permissions.
- The `sp_object_ids` output from this module will
  need to be input into the environment's `environment.yaml`
  ([example](../../../../environments/development/environment.yaml))
  and the environment's infrastructure will need to be re-applied.

These steps MUST be executed any time new runner groups are created
or they will not have access to AAD resources.

## Maintainer Notes

- In order to authenticate with the GitHub API, we have set
up a GitHub app following [this guide](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api). It is manually managed (no IaC - yet). It has the following parameters:
  - Name: `arc-cicd`
  - App Id: `379858`
  - Installation Id: `41013864`
