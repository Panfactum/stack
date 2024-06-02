{ pkgs }:

pkgs.stdenv.mkDerivation rec {
  pname = "terragrunt-util";
  version = "1.0";

  src = ./.; # This includes the script and source_files directory

  dontBuild = true; # No build phase needed

  installPhase = ''
    mkdir -p $out/bin

    cp ${src}/pf-update.sh $out/bin/pf-update
    chmod +x $out/bin/pf-update

    cp ${src}/pf-update-terragrunt.sh $out/bin/pf-update-terragrunt
    chmod +x $out/bin/pf-update-terragrunt

    cp ${src}/pf-update-envrc.sh $out/bin/pf-update-envrc
    chmod +x $out/bin/pf-update-envrc

    cp ${src}/pf-update-gitignore.sh $out/bin/pf-update-gitignore
    chmod +x $out/bin/pf-update-gitignore

    cp ${src}/pf-update-aws.sh $out/bin/pf-update-aws
    chmod +x $out/bin/pf-update-aws

    cp ${src}/pf-get-aws-state-hash.sh $out/bin/pf-get-aws-state-hash
    chmod +x $out/bin/pf-get-aws-state-hash

    cp ${src}/pf-update-kube.sh $out/bin/pf-update-kube
    chmod +x $out/bin/pf-update-kube

    cp ${src}/pf-get-kube-state-hash.sh $out/bin/pf-get-kube-state-hash
    chmod +x $out/bin/pf-get-kube-state-hash

    cp ${src}/pf-get-kube-user-state-hash.sh $out/bin/pf-get-kube-user-state-hash
    chmod +x $out/bin/pf-get-kube-user-state-hash

    cp ${src}/pf-update-ssh.sh $out/bin/pf-update-ssh
    chmod +x $out/bin/pf-update-ssh

    cp ${src}/pf-get-ssh-state-hash.sh $out/bin/pf-get-ssh-state-hash
    chmod +x $out/bin/pf-get-ssh-state-hash

    cp ${src}/pf-check-ssh.sh $out/bin/pf-check-ssh
    chmod +x $out/bin/pf-check-ssh

    cp ${src}/pf-check-repo-setup.sh $out/bin/pf-check-repo-setup
    chmod +x $out/bin/pf-check-repo-setup

    # Copy the static source files to $out/source_files
    mkdir -p $out/files
    cp -r ${src}/files/* $out/files/
  '';
}
