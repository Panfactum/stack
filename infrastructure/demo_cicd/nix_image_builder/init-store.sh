#!/usr/bin/env bash

set -eo pipefail

nix-env -iA nixpkgs.rsync

rsync -a --ignore-existing /nix/ /nix2/
