# Kubernetes GHA ARC Runners

**Type:** Live

This module provides:
- deployments of ARC [runner scale sets](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller) that can be
targeted in GHA workflows to execute our CI/CD scripts

The runners come pre-equipped with the following:

- a configured environment using `devenv`
  through our custom container image found here
- permissions needed to execute changes to
  the infrastructure through dynamic credentials:
  - admin access to the containing cluster
  - admin access to the AWS account containing the cluster
  - admin access to the vault instance in the cluster
  - ownership over the AAD apps created in the environment

## Maintainer Notes

- In order to authenticate with the GitHub API, we have set
up a GitHub app following [this guide](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api). It is manually managed (no IaC - yet). It has the following parameters:
  - Name: `arc-cicd`
  - App Id: `379858`
  - Installation Id: `41013864`
