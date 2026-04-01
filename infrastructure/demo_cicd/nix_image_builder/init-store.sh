#!/usr/bin/env bash

set -eo pipefail

nix-env -iA nixpkgs.rsync

rsync -a --update /nix/ /nix2/
