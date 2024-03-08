# Init

**Type:** Live

This module is used to initialize
the `TF_PLUGIN_CACHE_DIR` with the specific
versions of ALL providers that we use.

We must use `TF_PLUGIN_CACHE_DIR` in our CI pipelines
as otherwise EVERY module will re-download its own
copies of the providers. This amounts to 5GB+ of network
and disk usage on every environment deployment which
can add significant delays (and even crashes) on the
CI workload runs.

Our providers must be listed in a single
catch-all module as the
cache directory is not concurrency safe so
using `terragrunt run-all init` does not
work. See this [issue](https://github.com/gruntwork-io/terragrunt/issues/1212).



This module MUST provide ALL of the providers
that we use. All other modules MUST use
the same provider versions as defined in
here.
