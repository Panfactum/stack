{ pkgs, util, }: {
  env = with pkgs.lib; {
    CI = mkDefault "false"; # true iff running in a CI environment
    VAULT_ADDR = mkDefault "@INVALID@"; # the vault address
  };

  dotenv = {
    enable = true;
    disableHint = true;
  };

  packages = with pkgs; [
    ####################################
    # Kubernetes
    ####################################
    kubectl # kubernetes CLI
    kubectx # switching between namespaces and contexts
    kustomize # tool for editing manifests programatically
    kubernetes-helm # for working with Helm charts
    kube-capacity # for visualizing resource utilization in the cluster
    kubectl-cnpg # for managing the cnpg postgres databases
    (util.customNixModule
      "linkerd-await") # used to work with proxy sidecars in the kubernetes environment

    ####################################
    # Hashicorp Vault
    ####################################
    vault # provides the vault cli for interacting with vault
    (util.customShellScript
      "get-vault-token") # our helper tool for getting vault tokens during tf runs

    ####################################
    # Infrastructure-as-Code
    ####################################
    (util.customNixModule "terraform") # declarative iac tool
    (util.customNixModule "terragrunt") # terraform-runner
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
    awscli2 # aws CLI
    ssm-session-manager-plugin # for connecting to hardened ec2 nodes
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
    bind # dns utilies
    mtr # better traceroute alternative

    ####################################
    # Postgres Management
    ####################################
    (util.customShellScript
      "cnpg-pdb-patch") # patches all pdbs created by the cnpg operator
  ];
}
