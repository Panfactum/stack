#!/usr/bin/env bash

# Passthrough to the Panfactum CLI docker credential helper
# This wrapper exists to maintain backwards compatibility with existing Docker configurations

set -eo pipefail

# Pass the command as the first argument (default to "get" if not provided)
COMMAND="${1:-get}"

# Pass stdin through to the CLI command
pf docker credential-helper "$COMMAND"
