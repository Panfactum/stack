#!/usr/bin/env bash

set -eo pipefail

# This script is meant to be sourced inside the enterShell
# parameter of our devenv.nix

#############################################
## Kubernetes
#############################################

# Use repo-local kubeconfig file
export KUBECONFIG="$DEVENV_ROOT/$PF_KUBE_DIR/config"
export KUBE_CONFIG_PATH="$DEVENV_ROOT/$PF_KUBE_DIR/config"

## TODO: Make this a command that parses the output of the terraform module
## Setup access to the development-primary kubernetes cluster
#kubectl config set-credentials development-primary \
#  --exec-api-version "client.authentication.k8s.io/v1beta1" \
#  --exec-command aws \
#  --exec-arg --region,us-west-2,eks,get-token,--cluster-name,development-primary \
#  --exec-env AWS_PROFILE=development-superuser
#
#kubectl config set-cluster development-primary \
#  --server https://816EF3BEAC08244FA2032C5C09A5D503.gr7.us-east-2.eks.amazonaws.com \
#  --certificate-authority "$DEVENV_ROOT/.kube/development-primary.crt" \
#  --embed-certs
#
#kubectl config set-context development-primary \
#  --user development-primary \
#  --cluster development-primary

#############################################
## AWS
#############################################

# Use repo-local AWS settings
export AWS_SHARED_CREDENTIALS_FILE="$DEVENV_ROOT/$PF_AWS_DIR/credentials"
export AWS_CONFIG_FILE="$DEVENV_ROOT/$PF_AWS_DIR/config"
export AWS_PROFILE=development-superuser #TODO: Move to the .env file

#############################################
## Terraform
#############################################

# Use repo-local terragrunt downloads
export TERRAGRUNT_DOWNLOAD="$DEVENV_ROOT/.terragrunt-cache"

#############################################
## Podman / Docker
#############################################

# We provide a custom credential helper so we can avoid
# the nuisance of the ECR login flow
export REGISTRY_AUTH_FILE="$DEVENV_ROOT/.podman/config.json"
export DOCKER_CONFIG="$DEVENV_ROOT/.podman" # Needed for buildkit to work

#############################################
## Run checks
#############################################
pf-check-repo-setup
