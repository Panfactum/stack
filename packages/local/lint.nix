{ pkgs }:
let
  yamlFormat = pkgs.formats.yaml { };

  checkPackageJson = pkgs.writeShellScript "ds-check-package-json" ''
    export NODE_PATH="$REPO_ROOT/packages/website/node_modules"
    cd "$REPO_ROOT"
    exec ${pkgs.bun}/bin/bun run ${./scripts/ds-check-package-json.ts} "$@"
  '';

  lintWebsite = pkgs.writeShellScript "ds-lint-website" ''
    set -eo pipefail
    (
      cd "$REPO_ROOT"
      export NODE_OPTIONS=--max-old-space-size=8192
      export LINT=true
      export ESLINT_USE_FLAT_CONFIG=false
      ${pkgs.bun}/bin/bunx eslint --fix --config packages/website/.eslintrc.cjs "$@"
    )
  '';

  typecheckWebsite = pkgs.writeShellScript "ds-typecheck-website" ''
    set -eo pipefail
    (
      cd "$REPO_ROOT/packages/website"
      export NODE_OPTIONS=--max-old-space-size=8192
      ${pkgs.bun}/bin/bun run check
    )
  '';

  lintCli = pkgs.writeShellScript "ds-lint-cli" ''
    set -eo pipefail
    (
      cd "$REPO_ROOT"
      export NODE_OPTIONS=--max-old-space-size=8192
      ${pkgs.bun}/bin/bunx eslint --fix "$@"
    )
  '';

  typecheckCli = pkgs.writeShellScript "ds-typecheck-cli" ''
    set -eo pipefail
    (
      cd "$REPO_ROOT/packages/cli"
      export NODE_OPTIONS=--max-old-space-size=8192
      ${pkgs.bun}/bin/bun check
    )
  '';

  generateTfReference = pkgs.writeShellScript "ds-generate-tf-reference" ''
    set -e
    modules=()
    for file in "$@"; do
      if [[ $file =~ ^packages/infrastructure/([^/]+)/ ]]; then
        module="''${BASH_REMATCH[1]}"
        found=false
        for existing_module in "''${modules[@]}"; do
          if [[ "$existing_module" == "$module" ]]; then
            found=true
            break
          fi
        done
        if [[ "$found" == "false" ]]; then
          modules+=("$module")
        fi
      fi
    done
    for module in "''${modules[@]}"; do
      echo "Generating reference docs for changed module: $module"
      ds-generate-tf-reference "$module"
    done
    exit 0
  '';
in
yamlFormat.generate "pre-commit-config.yaml" {
  repos = [
    {
      repo = "https://github.com/pre-commit/pre-commit-hooks";
      rev = "v5.0.0";
      hooks = [
        {
          id = "check-merge-conflict";
          priority = 0;
        }
        {
          id = "check-symlinks";
          priority = 0;
        }
        {
          id = "mixed-line-ending";
          priority = 0;
        }
      ];
    }
    {
      repo = "local";
      hooks = [
        # Priority 0: Fast, file-level checks (run concurrently)
        {
          id = "lint-spellcheck";
          name = "Spellcheck";
          entry = "${pkgs.cspell}/bin/cspell lint --no-progress --gitignore";
          language = "system";
          files = ''\.(md|mdx)$'';
          pass_filenames = true;
          description = "Runs spellcheck on markdown files";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "shellcheck";
          name = "Shellcheck";
          entry = "${pkgs.shellcheck}/bin/shellcheck";
          language = "system";
          files = ''^packages/(devshell|installer|infrastructure)/.*\.sh$'';
          pass_filenames = true;
          description = "Runs shellcheck on shell scripts";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "shellfmt";
          name = "Shell Format";
          entry = "${pkgs.shfmt}/bin/shfmt -w -i 2";
          language = "system";
          files = ''^packages/(devshell|installer|infrastructure)/.*\.sh$'';
          pass_filenames = true;
          description = "Runs shfmt on shell scripts";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "deadnix";
          name = "Deadnix";
          entry = "${pkgs.deadnix}/bin/deadnix --edit";
          language = "system";
          files = ''^(flake\.nix|packages/(cli|devshell|local)/.*\.nix)$'';
          exclude = ''(^|/)bun\.nix$'';
          pass_filenames = true;
          description = "Removes dead code from Nix files with deadnix";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "hcl-fmt";
          name = "HCL Format";
          entry = "${pkgs.terragrunt}/bin/terragrunt hcl fmt --file";
          language = "system";
          files = ''^packages/cli/.*\.hcl$'';
          pass_filenames = true;
          description = "Runs hclfmt on HCL files";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "tf-fmt";
          name = "Tofu Format";
          entry = "${pkgs.opentofu}/bin/tofu fmt";
          language = "system";
          files = ''^(packages/infrastructure|infrastructure)/.*\.tf$'';
          pass_filenames = true;
          description = "Runs tofu fmt on the infrastructure code";
          fail_fast = false;
          priority = 0;
        }
        {
          id = "check-package-json";
          name = "Check Package JSON Consistency";
          entry = "${checkPackageJson}";
          language = "system";
          files = ''(^|/)package\.json$'';
          pass_filenames = false;
          description = "Ensures all dependencies are pinned and consistent across packages";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "validate-changelog-schema";
          name = "Validate Changelog Schema";
          entry = "ds-validate-changelog";
          language = "system";
          files = ''^packages/website/src/content/changelog/.*/log\.yaml$'';
          pass_filenames = true;
          description = "Validates changelog log.yaml files against the JSON schema";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "validate-changelog-review-schema";
          name = "Validate Changelog Review Schema";
          entry = "ds-validate-changelog-review";
          language = "system";
          files = ''^packages/website/src/content/changelog/.*/review\.yaml$'';
          pass_filenames = true;
          description = "Validates changelog review.yaml files against the JSON schema";
          fail_fast = true;
          priority = 0;
        }
        {
          id = "validate-metadata-schema";
          name = "Validate Metadata Schema";
          entry = "ds-validate-iac-metadata";
          language = "system";
          files = ''^packages/infrastructure/metadata\.yaml$'';
          pass_filenames = true;
          description = "Validates metadata.yaml against the JSON schema";
          fail_fast = true;
          priority = 0;
        }

        # Priority 1: Statix and generators (run concurrently)
        {
          id = "statix";
          name = "Statix";
          entry = "${pkgs.statix}/bin/statix fix";
          language = "system";
          files = ''^(flake\.nix|packages/(cli|devshell|local)/.*\.nix)$'';
          exclude = ''(^|/)bun\.nix$'';
          pass_filenames = false;
          description = "Fixes Nix antipatterns with statix";
          fail_fast = true;
          priority = 1;
        }
        {
          id = "generate-tf-reference";
          name = "Generate Terraform Reference";
          entry = "${generateTfReference}";
          language = "system";
          files = "^packages/infrastructure/[^/]+/";
          pass_filenames = true;
          description = "Generates terraform reference docs for changed modules";
          fail_fast = false;
          priority = 1;
        }

        # Priority 2: Nixfmt and typechecks (run concurrently)
        {
          id = "nixfmt";
          name = "Nix Format";
          entry = "${pkgs.nixfmt}/bin/nixfmt";
          language = "system";
          files = ''^(flake\.nix|packages/(cli|devshell|local)/.*\.nix)$'';
          exclude = ''(^|/)bun\.nix$'';
          pass_filenames = true;
          description = "Runs nixfmt on Nix files";
          fail_fast = true;
          priority = 2;
        }
        {
          id = "typecheck-website";
          name = "Typecheck Website";
          entry = "${typecheckWebsite}";
          language = "system";
          files = "^packages/website/";
          pass_filenames = false;
          description = "Runs a typecheck on the website code";
          fail_fast = true;
          priority = 2;
        }
        {
          id = "typecheck-cli";
          name = "Typecheck CLI";
          entry = "${typecheckCli}";
          language = "system";
          files = "^packages/cli/";
          pass_filenames = false;
          description = "Runs a typecheck on the CLI code";
          fail_fast = true;
          priority = 2;
        }

        # Priority 3: Linters (run concurrently)
        {
          id = "lint-website";
          name = "Lint Website";
          entry = "${lintWebsite}";
          language = "system";
          files = ''^packages/website/src/.*\.(ts|tsx|astro)$'';
          pass_filenames = true;
          description = "Runs linting for the website code";
          fail_fast = true;
          priority = 3;
        }
        {
          id = "lint-cli";
          name = "Lint CLI";
          entry = "${lintCli}";
          language = "system";
          files = ''^packages/cli/.*\.ts$'';
          pass_filenames = true;
          description = "Runs linting for the CLI code";
          fail_fast = true;
          priority = 3;
        }
      ];
    }
  ];
}
