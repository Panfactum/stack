{
  pkgs,
  bunPkgs,
  bun2nix,
}:
let
  prekConfig = import ./lint.nix { inherit pkgs bunPkgs; };
  scripts = import ./scripts { inherit pkgs; };
  hooksConfig = import ./hooks { inherit pkgs scripts; };
in
{

  shellHook = ''
    export REPO_ROOT=$(git rev-parse --show-toplevel)
    install -m 644 ${prekConfig} "$REPO_ROOT/.pre-commit-config.yaml"
    install -m 644 ${hooksConfig.settingsJson} "$REPO_ROOT/.claude/settings.json"
    export TERRAFORM_MODULES_DIR="$REPO_ROOT/packages/infrastructure";
    export PF_IAC_DIR="$REPO_ROOT/packages/infrastructure";
    export GOBIN="$REPO_ROOT/go/bin";
    export GOPATH="$REPO_ROOT/go";
    git config --unset-all --local core.hooksPath
    # Lock directory lives under the git common dir so locks are shared
    # across all worktrees. Concurrent devshell starts (multiple terminals
    # or worktrees) would otherwise race each other — pnpm/bun clobber the
    # same global stores and prek writes to the shared `.bare/hooks/`.
    #
    # We use `mkdir` (atomic on POSIX) rather than `flock` so the lock
    # works on both Linux and macOS without pulling in util-linux.
    LOCK_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)/devshell-locks"
    mkdir -p "$LOCK_DIR"
    # Each call site invokes this with `&`, so bash runs it in a subshell;
    # that's what scopes the EXIT/signal trap below to a single invocation
    # instead of the caller's shell.
    run_install() {
      local name="$1"
      shift
      local lockdir="$LOCK_DIR/$name.lock"
      local pidfile="$lockdir/pid"
      local waited=0
      while ! mkdir "$lockdir" 2>/dev/null; do
        # Reap a stale lock left behind by a crashed previous devshell.
        if [ -f "$pidfile" ] && ! kill -0 "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null; then
          rm -rf "$lockdir"
          continue
        fi
        sleep 0.2
        waited=$((waited + 1))
        if [ "$waited" -gt 1500 ]; then # ~5 minutes
          # We'd rather force-release and race than hang the devshell forever.
          echo "[$name] lock held for >5min; forcing release and proceeding" >&2
          rm -rf "$lockdir"
          waited=0
        fi
      done
      # Release the lock on any exit path — normal return, error, Ctrl-C,
      # SIGTERM, SIGHUP (terminal close) — so we never leak a stale lock.
      trap 'rm -rf "$lockdir"' EXIT HUP INT TERM
      echo $$ > "$pidfile"
      local output
      if ! output=$("$@" 2>&1); then
        echo "[$name] failed:" >&2
        echo "$output" >&2
      fi
      rm -rf "$lockdir"
      trap - EXIT HUP INT TERM
    }
    # Note: do NOT pass -c here. The bare-repo + worktrees layout means
    # `.bare/hooks/pre-commit` is shared across worktrees; passing -c bakes
    # the absolute path of the installing worktree's config into the hook,
    # so commits from other worktrees would silently use the wrong config.
    # Without -c, prek resolves .pre-commit-config.yaml from the worktree
    # being committed to at hook execution time.
    run_install prek ${pkgs.prek}/bin/prek install --quiet &
    run_install pnpm ${pkgs.pnpm}/bin/pnpm install --recursive --frozen-lockfile --prefer-offline --silent &
    run_install bun-cli sh -c 'cd "$REPO_ROOT/packages/cli" && ${bunPkgs.bun}/bin/bun install --silent --frozen-lockfile' &
    run_install bun-scraper sh -c 'cd "$REPO_ROOT/packages/scraper" && ${bunPkgs.bun}/bin/bun install --silent --frozen-lockfile' &
    run_install bun-website sh -c 'cd "$REPO_ROOT/packages/website" && ${bunPkgs.bun}/bin/bun install --silent --frozen-lockfile' &
    wait
  '';

  packages = with pkgs; [
    ####################################
    # Custom Scripts
    ####################################
    scripts
    hooksConfig.package

    ####################################
    # Programming Langauges
    ####################################
    nodejs_25 # nodejs runtime
    pnpm # nodejs package manager
    go # go programming language
    upx # compressing go binaries
    bunPkgs.bun # bun runtime
    bun2nix # utility for building nix derivations from bun projects
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
    statix
    deadnix
    cspell
    prek
  ];
}
