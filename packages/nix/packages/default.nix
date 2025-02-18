{
  pkgs,
  kubeUtilsPkgs,
  awsUtilsPkgs,
  tfUtilsPkgs,
  buildkitPkgs,
  redisPkgs,
  postgresPkgs,
  vaultPkgs,
  linkerdPkgs,
  kyvernoPkgs,
  natsPkgs,
}:
let
  # Custom Packages
  customTerragrunt = pkgs.writeShellScriptBin "terragrunt" ''
    #!/bin/env bash

    export GIT_LFS_SKIP_SMUDGE=1
    for arg in "$@"
    do
        if [[ "$arg" == "run-all" ]]; then
            export TERRAGRUNT_PROVIDER_CACHE=1
            export TERRAGRUNT_PROVIDER_CACHE_DIR="$TF_PLUGIN_CACHE_DIR"
            ${tfUtilsPkgs.terragrunt}/bin/terragrunt "$@"
            exit "$?"
        fi
    done
    {
      stdbuf -oL ${tfUtilsPkgs.terragrunt}/bin/terragrunt "$@" 2> >(stdbuf -oL sed "s/$GIT_PASSWORD/redacted/g" >&2)
    } | stdbuf -oL sed "s/$GIT_PASSWORD/redacted/g"

    exit ''${PIPESTATUS[0]}
  '';
  cilium = pkgs.symlinkJoin {
    name = "cilium-cli";
    paths = [ kubeUtilsPkgs.cilium-cli ];
    buildInputs = [ kubeUtilsPkgs.makeWrapper ];
    postBuild = ''
      wrapProgram $out/bin/cilium \
        --add-flags "-n cilium"
    '';
  };
in
with pkgs;
[

  ####################################
  # Custom Panfactum Scripts
  ####################################
  (import ./scripts { inherit pkgs; })

  ####################################
  # Kubernetes
  ####################################
  kubeUtilsPkgs.kubectl # kubernetes CLI
  kubeUtilsPkgs.kubectx # switching between namespaces and contexts
  kubeUtilsPkgs.kustomize # tool for editing manifests programatically
  kubeUtilsPkgs.kubernetes-helm # for working with Helm charts
  kubeUtilsPkgs.kube-capacity # for visualizing resource utilization in the cluster
  kubeUtilsPkgs.kubectl-cnpg # for managing the cnpg postgres databases
  kubeUtilsPkgs.kubectl-evict-pod # for initiating pod evictions
  linkerdPkgs.linkerd_edge # utility for working with the service mesh
  cilium # for managing the cilium CNI
  kubeUtilsPkgs.argo # utility for working with argo workflows
  kubeUtilsPkgs.cmctl # for working with cert-manager
  kubeUtilsPkgs.stern # log aggregator for quick cli log inspection
  kubeUtilsPkgs.velero # backups of cluster state
  kubeUtilsPkgs.k9s # kubernetes tui
  kyvernoPkgs.kyverno # kubernetes policy engine cli

  ####################################
  # Hashicorp Vault
  ####################################
  vaultPkgs.vault # provides the vault cli for interacting with vault

  ####################################
  # Infrastructure-as-Code
  ####################################
  tfUtilsPkgs.opentofu # declarative iac tool (open alternative to terraform)
  customTerragrunt # opentofu-runner

  ####################################
  # Editors
  ####################################
  micro # a nano alternative with better keybindings
  less # better pager

  ####################################
  # Bash Scripting Utilities
  ####################################
  coreutils # GNU core utilities
  bash # shell
  parallel # run bash commands in parallel
  ripgrep # better alternative to grep
  rsync # file synchronization
  unzip # extraction utility for zip format
  zx # General purpose data compression utility
  entr # Re-running scripts when files change
  bc # bash calculator
  jq # json
  yq # yaml
  fzf # fuzzy selector
  getopt # for parsing command-line arguments
  envsubst # environment substitution in files
  gawk # awk
  gnused # sed
  gnugrep # grep
  gnutar # tar
  findutils # find
  gzip # compression programs
  procps # process info
  lsof # query for open files and (and other fds like ports)
  mktemp # utility for making temporary directories and files
  hcl2json # utility for converting HCL to JSON

  ####################################
  # AWS Utilities
  ####################################
  awsUtilsPkgs.awscli2 # aws CLI
  awsUtilsPkgs.ssm-session-manager-plugin # for connecting to hardened ec2 nodes
  awsUtilsPkgs.aws-nuke # nukes resources in aws accounts

  ####################################
  # Secrets Management
  ####################################
  croc # P2P secret sharing
  sops # terminal editor for secrets stored on disk; integrates with tf ecosystem for config-as-code

  ####################################
  # Version Control
  ####################################
  git # vcs CLI
  git-lfs # stores binary files in git host

  ####################################
  # Container Utilities
  ####################################
  buildkitPkgs.buildkit # used for building containers using moby/buildkit
  buildkitPkgs.skopeo # used for moving images around
  buildkitPkgs.manifest-tool # for working with image manifests

  ####################################
  # Network Utilities
  ####################################
  dig # dns lookup
  mtr # better traceroute alternative
  openssh # ssh client and server
  autossh # automatically restart tunnels
  step-cli # working with certificates
  curl # submit network requests from the CLI

  ####################################
  # Database Tools
  ####################################
  redisPkgs.redis # redis-cli
  postgresPkgs.postgresql_16 # psql, cli for working with postgres
  natsPkgs.natscli # cli for NATS
  natsPkgs.nsc # cli for configuring NATS accounts
  natsPkgs.nats-top # cli for configuring NATS accounts
  # postgresPkgs.barman # barman cli for backups and restore with postgres (Broken on MacOS b/c of https://github.com/NixOS/nixpkgs/issues/346003)
]
