{ pkgs, util, }:
({ config, ... }:
  let
    local = config.env.CI != "true";
    mkIf = pkgs.lib.mkIf;
    mkOverride = pkgs.lib.mkOverride;
  in {
    env = { LOCAL_DEV_NAMESPACE = mkOverride 1001 "@INVALID@"; };

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
        (import ./k9s.nix) # kubernetes tui

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
