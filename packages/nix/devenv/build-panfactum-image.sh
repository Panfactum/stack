#!/usr/bin/env bash

set -eo pipefail

TAG="${1:-latest}"

echo "$GITHUB_TOKEN" | podman login ghcr.io -u fullkykubed --password-stdin
(
  cd "$DEVENV_ROOT"
  podman load <"$(nix build .#image --print-out-paths --no-link)"
  podman tag localhost/panfactum:latest ghcr.io/panfactum/panfactum:"$TAG"
  podman push "ghcr.io/panfactum/panfactum:$TAG"
)
