{ pkgs, scripts }:

let
  jsonFormat = pkgs.formats.json { };

  bashBin = "${pkgs.bash}/bin/bash";
  jqBin = "${pkgs.jq}/bin/jq";
  grepBin = "${pkgs.gnugrep}/bin/grep";

  guardGeneratedFiles = pkgs.replaceVars ./hook-guard-generated-files.sh {
    bash = bashBin;
    jq = jqBin;
  };

  guardVersionedDocs = pkgs.replaceVars ./hook-guard-versioned-docs.sh {
    bash = bashBin;
    jq = jqBin;
  };

  guardNpx = pkgs.replaceVars ./hook-guard-npx.sh {
    bash = bashBin;
    jq = jqBin;
    grep = grepBin;
  };

  guardGitShow = pkgs.replaceVars ./hook-guard-git-show.sh {
    bash = bashBin;
    jq = jqBin;
    grep = grepBin;
  };

  lint = pkgs.replaceVars ./hook-lint.sh {
    bash = bashBin;
    jq = jqBin;
    cspell = "${pkgs.cspell}/bin/cspell";
    shellcheck = "${pkgs.shellcheck}/bin/shellcheck";
    validateChangelog = "${scripts}/bin/ds-validate-changelog";
    validateChangelogReview = "${scripts}/bin/ds-validate-changelog-review";
    validateIacMetadata = "${scripts}/bin/ds-validate-iac-metadata";
    checkPackageJson = "${scripts}/bin/ds-check-package-json";
  };

  regenerateSchemas = pkgs.replaceVars ./hook-regenerate-schemas.sh {
    bash = bashBin;
    jq = jqBin;
    generateChangelogSchemas = "${scripts}/bin/ds-generate-changelog-schemas";
  };

  stopLint = pkgs.replaceVars ./hook-stop-lint.sh {
    bash = bashBin;
    prek = "${pkgs.prek}/bin/prek";
    git = "${pkgs.git}/bin/git";
    sha256sum = "${pkgs.coreutils}/bin/sha256sum";
  };

  package = pkgs.stdenv.mkDerivation {
    pname = "devShell-hooks";
    version = "1.0";
    dontUnpack = true;
    installPhase = ''
      mkdir -p $out/bin
      cp ${guardGeneratedFiles} $out/bin/hook-guard-generated-files
      cp ${guardVersionedDocs} $out/bin/hook-guard-versioned-docs
      cp ${guardNpx} $out/bin/hook-guard-npx
      cp ${guardGitShow} $out/bin/hook-guard-git-show
      cp ${lint} $out/bin/hook-lint
      cp ${regenerateSchemas} $out/bin/hook-regenerate-schemas
      cp ${stopLint} $out/bin/hook-stop-lint
      chmod +x $out/bin/*
    '';
  };

  settingsJson = jsonFormat.generate "settings.json" {
    hooks = {
      PreToolUse = [
        {
          matcher = "Edit|Write";
          hooks = [
            {
              type = "command";
              command = "${package}/bin/hook-guard-generated-files";
            }
            {
              type = "command";
              command = "${package}/bin/hook-guard-versioned-docs";
            }
          ];
        }
        {
          matcher = "Bash";
          hooks = [
            {
              type = "command";
              command = "${package}/bin/hook-guard-npx";
            }
            {
              type = "command";
              command = "${package}/bin/hook-guard-git-show";
            }
          ];
        }
      ];
      PostToolUse = [
        {
          matcher = "Edit|Write";
          hooks = [
            {
              type = "command";
              command = "${package}/bin/hook-lint";
            }
            {
              type = "command";
              command = "${package}/bin/hook-regenerate-schemas";
            }
          ];
        }
      ];
      Stop = [
        {
          hooks = [
            {
              type = "command";
              command = "${package}/bin/hook-stop-lint";
            }
          ];
        }
      ];
    };
  };

in
{
  inherit package settingsJson;
}
