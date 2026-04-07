{
  pkgs,
  bunPkgs,
  bun2nix,
}:
{

  shellHook = ''
    export REPO_ROOT=$(git rev-parse --show-toplevel)
    export TERRAFORM_MODULES_DIR="$REPO_ROOT/packages/infrastructure";
    export PF_IAC_DIR="$REPO_ROOT/packages/infrastructure";
    export GOBIN="$REPO_ROOT/go/bin";
    export GOPATH="$REPO_ROOT/go";
    git config --unset-all --local core.hooksPath
    run_install() {
      local name="$1"
      shift
      local output
      if ! output=$("$@" 2>&1); then
        echo "[$name] failed:" >&2
        echo "$output" >&2
      fi
    }
    # Note: do NOT pass -c here. The bare-repo + worktrees layout means
    # `.bare/hooks/pre-commit` is shared across worktrees; passing -c bakes
    # the absolute path of the installing worktree's config into the hook,
    # so commits from other worktrees would silently use the wrong config.
    # Without -c, prek resolves .pre-commit-config.yaml from the worktree
    # being committed to at hook execution time.
    run_install prek prek install --quiet &
    run_install pnpm pnpm install --recursive --frozen-lockfile --prefer-offline --silent &
    run_install bun bun install --silent --frozen-lockfile &
    wait
  '';

  packages = with pkgs; [
    ####################################
    # Custom Scripts
    ####################################
    (import ./scripts { inherit pkgs; })

    ####################################
    # Programming Langauges
    ####################################
    nodejs_25 # nodejs runtime
    nodePackages_latest.pnpm # nodejs package manager
    go # go programming language
    upx # compressing go binaries
    bunPkgs.bun # bun runtime
    bun2nix.bin # utility for building nix derivations from bun projects
    uv # Installing python utilities

    ####################################
    # Version Control
    ####################################
    git # vcs CLI
    git-lfs # stores binary files in git host

    #########################################
    # IaC Tools
    #########################################
    terraform-docs # tool for generating documentation from terraform modules

    #########################################
    # Linters
    #########################################
    shellcheck
    shfmt
    nixfmt
    nodePackages.cspell
    prek
  ];
}
