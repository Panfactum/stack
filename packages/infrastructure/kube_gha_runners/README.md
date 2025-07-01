# GHA Runners

This module provides deployments of [self-hosted GHA runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller) 
that can be targeted in GHA workflows.

For installation instructions, see our [guide](/docs/main/guides/addons/github-actions/installing).

## Usage

### Connecting the Runner to GitHub

Follow [GitHub's documentation](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api#authenticating-arc-with-a-personal-access-token-classic) to provision a
Classic Personal Access Token (PAT) with the correct permissions. Provide this token
as an input via `github_token`.

For each runner, 
set the `github_config_url` to the URL of your repository, organization, or enterprise. This is the entity
that the runners will belong to. We generally recommend making the runner available at the organization level
so that all of your organization's repositories can use the runner in their GHA workflows.

### Referencing the Runner in a Workflow

The runner's name is the key that you use specify in the `runners` input:

```hcl
inputs = {
  runners = {
    default = {
      ...
    }
  }
}
```

After you apply this module, you can specify which GHA workflow jobs will use the runner as follows:

```yaml
jobs:
  test:
    runs-on: default
```

### Reducing Startup Times

By default, this module does not provision any idle runners. As a result, when new workflow jobs are created,
the jobs are delayed by 1-2 minutes as runners initialize. 

For each runner, you can set `min_replicas` to a non-zero value to allow idle runners in your cluster. These
will be ready to receive new workflow jobs immediately and reduce your overall workflow runtimes.
However, these will also consume their full amount of allocated resources (CPU, memory, storage)
in the cluster while sitting idle.