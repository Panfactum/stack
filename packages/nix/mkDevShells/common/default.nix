{ pkgs, util, }: {
  env = with pkgs.lib; {
    CI = mkOverride 1001 "false"; # true iff running in a CI environment
    VAULT_ADDR = mkOverride 1001 "@INVALID@"; # the vault address
    PF_AWS_DIR = mkOverride 1001 ".aws";
    PF_SSH_DIR = mkOverride 1001 ".ssh";
    PF_KUBE_DIR = mkOverride 1001 ".kube";
  };

  dotenv = with pkgs.lib; {
    enable = mkOverride 1001 true;
    disableHint = mkOverride 1001 true;
  };

  enterShell = ''
    # This resolves an issue where the in-progress 1.0 devenv pollutes the environment
    # with a PYTHONPATH. It will be resolved once https://github.com/cachix/devenv/pull/1005 completes.
    unset PYTHONPATH
  '';

  scripts = {
    terraform.exec = "tofu $@"; # Alias terraform with tofu to prevent confusion
  };

  packages = with pkgs; [
    ####################################
    # System Setup
    ####################################
    (import ./setup { inherit pkgs; })

    ####################################
    # Kubernetes
    ####################################
    (import ./kubectl.nix) # kubernetes CLI
    (import ./kubectx.nix) # switching between namespaces and contexts
    (import ./kustomize.nix) # tool for editing manifests programatically
    (import ./kustomize.nix) # tool for editing manifests programatically
    (import ./helm.nix) # for working with Helm charts
    (util.customShellScript
      "pf-get-kube-token") # used for authentication within kube_config
    (import
      ./kube-capacity.nix) # for visualizing resource utilization in the cluster
    (import ./kubectl-cnpg.nix) # for managing the cnpg postgres databases
    (import ./linkerd.nix) # utility for working with the service mesh
    (util.customNixModule "cilium") # for managing the cilium CNI
    (import ./cmctl.nix) # for working with cert-manager
    (import ./stern.nix) # log aggregator for quick cli log inspection
    (import ./velero.nix) # backups of cluster state
    (util.customShellScript
      "pf-tunnel") # for connecting to private network resources through ssh bastion

    ####################################
    # Hashicorp Vault
    ####################################
    (import ./vault.nix) # provides the vault cli for interacting with vault
    (util.customShellScript
      "pf-get-vault-token") # our helper tool for getting vault tokens during tf runs

    ####################################
    # Infrastructure-as-Code
    ####################################
    (import
      ./opentofu.nix) # declarative iac tool (open alternative to terraform)
    (import ./terragrunt.nix) # opentofu-runner
    (util.customShellScript "get-version-hash") # helper for the IaC tagging
    (util.customShellScript
      "wait-on-image") # helper for waiting on image availability

    ####################################
    # Editors
    ####################################
    micro # a nano alternative with better keybindings
    less # better pager

    ####################################
    # Network Utilities
    ####################################
    curl # submit network requests from the CLI

    ####################################
    # Parsing Utilities
    ####################################
    jq # json
    yq # yaml
    fzf # fuzzy selector

    ####################################
    # Bash Scripting Utilities
    ####################################
    parallel # run bash commands in parallel
    ripgrep # better alternative to grep
    rsync # file synchronization
    unzip # extraction utility for zip format
    zx # General purpose data compression utility
    entr # Re-running scripts when files change
    bc # bash calculator

    ####################################
    # AWS Utilities
    ####################################
    (import ./aws.nix) # aws CLI
    (import
      ./ssm-session-manager-plugin.nix) # for connecting to hardened ec2 nodes
    aws-nuke # nukes resources in aws accounts

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
    # CI / CD
    ####################################
    gh # github cli
    actionlint # gha linter
    (util.customShellScript
      "get-buildkit-address") # Helper used to get the buildkit address to use for building images
    (util.customShellScript
      "scale-buildkit") # Helper used for autoscaling buildkit

    ####################################
    # Container Utilities
    ####################################
    #(customShellScript "docker-credential-aws")  # our package for ecr authentication
    buildkit # used for building containers using moby/buildkit
    skopeo # used for moving images around

    ####################################
    # Network Utilities
    ####################################
    dig # dns lookup
    mtr # better traceroute alternative

    ####################################
    # Database Tools
    ####################################
    (util.customShellScript
      "cnpg-pdb-patch") # patches all pdbs created by the cnpg operator
    (import ./redis.nix) # redis-cli
    (import ./postgresql.nix) # psql, cli for working with postgres
    (import ./barman.nix) # barman cli for backups and restore with postgres
    (util.customShellScript
      "pf-db-tunnel") # for connecting to private databases through ssh bastion
    (util.customShellScript
      "pf-get-db-creds") # gets database credentials from vault
  ];
}
