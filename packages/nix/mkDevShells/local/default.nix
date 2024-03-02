{ pkgs, util, }:
({ config, ... }:
  let
    local = config.env.CI != "true";
    mkIf = pkgs.lib.mkIf;
    mkDefault = pkgs.lib.mkDefault;
  in {
    env = { LOCAL_DEV_NAMESPACE = mkDefault "@INVALID@"; };

    enterShell = mkIf local ''
      source enter-shell-local
    '';

    packages = with pkgs;
      mkIf local [
        ####################################
        # Devenv Setup
        ####################################
        (util.customShellScript "enter-shell-local")

        ####################################
        # Postgres Management
        ####################################
        (util.customNixModule "pgadmin4")
        pgcli # postgres cli tools
        (util.customShellScript
          "get-db-creds") # cli for using vault to get db creds

        ####################################
        # Container Management
        ####################################
        podman # container management CLI
        tilt # local CI tool for building and deploying containers

        ####################################
        # Kubernetes
        ####################################
        (util.customNixModule "cilium") # for managing the cilium CNI
        hubble # for network observability
        cmctl # for working with cert-manager
        linkerd # for working with the service mesh
        k9s # kubernetes tui

        ####################################
        # Network Utilities
        ####################################
        openssh # ssh client and server
        autossh # automatically restart tunnels
        step-cli # working with certificates
        (util.customShellScript
          "tunnel") # for connecting to private network resources through ssh bastion
      ];
  })
