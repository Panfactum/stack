#!/usr/bin/env sh

set -e

# DO NOT EDIT WITHOUT CHANGING THE CICD PIPELINE
VERSION="main"

GIT_MIN_VERSION="2.40"
NIX_MIN_VERSION="2.23"
DIRENV_MIN_VERSION="2.32"

print_panfactum() {
  printf "\n██████╗  █████╗ ███╗   ██╗███████╗ █████╗  ██████╗████████╗██╗   ██╗███╗   ███╗\n" >&2
  printf "██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝██║   ██║████╗ ████║\n" >&2
  printf "██████╔╝███████║██╔██╗ ██║█████╗  ███████║██║        ██║   ██║   ██║██╔████╔██║\n" >&2
  printf "██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██╔══██║██║        ██║   ██║   ██║██║╚██╔╝██║\n" >&2
  printf "██║     ██║  ██║██║ ╚████║██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║ ╚═╝ ██║\n" >&2
  printf "╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝     ╚═╝\n\n" >&2
}

# Check that the user is running on a supported platform
check_platform() {
  case "$(uname -s)" in
  Linux*)
    # Check if running in WSL
    if grep -q Microsoft /proc/version 2>/dev/null; then
      # Check WSL version
      # shellcheck disable=SC2143
      if grep -q "WSL2" /proc/version 2>/dev/null || [ -n "$(uname -r | grep -i "WSL2")" ]; then
        printf "Running on WSL2. Beginning installation...\n" >&2
      else
        printf "\033[31mYou appear to be running WSL version 1. Please upgrade to WSL2 to continue.\033[0m\n" >&2
        exit 1
      fi
    else
      printf "Running on Linux. Beginning installation...\n\n" >&2
    fi
    ;;
  Darwin*)
    printf "Running on macOS. Beginning installation...\n\n" >&2
    ;;
  *)
    printf "\033[31mUnsupported platform: %s\033[0m\n" "$(uname -s)" >&2
    printf "\033[31mThis installer only supports Linux, macOS, or Windows with WSL2.\033[0m\n" >&2
    exit 1
    ;;
  esac
}

# Check that the user has minimum git version installed
check_git_version() {
  if ! command -v git >/dev/null 2>&1; then
    printf "\033[31mGit is not installed. Please install Git version %s or higher.\033[0m\n" "$GIT_MIN_VERSION" >&2
    exit 1
  fi

  git_version=$(git --version | awk '{print $3}')

  if [ "$(printf '%s\n' "$GIT_MIN_VERSION" "$git_version" | sort -V | head -n1)" != "$GIT_MIN_VERSION" ]; then
    printf "  \033[31mGit version %s is installed, but version %s or higher is required.\033[0m\n" "$git_version" "$GIT_MIN_VERSION" >&2
    exit 1
  fi

  printf "  \033[32mRequired Git version %s is already installed.\033[0m\n" "$git_version" >&2
}

# Check that at least version 2.23 of nix is installed. If not, run the determinate installer.
check_nix_version() {
  if command -v nix >/dev/null 2>&1; then
    nix_version=$(nix --version 2>/dev/null | awk '{print $NF}')

    if [ "$(printf '%s\n' "$NIX_MIN_VERSION" "$nix_version" | sort -V | head -n1)" = "$NIX_MIN_VERSION" ]; then
      printf "  \033[32mRequired Nix version %s is already installed.\033[0m\n" "$nix_version" >&2
      return 0
    else
      printf "  \033[31mNix version %s is installed, but version %s or higher is required. Upgrade Nix using the package manager that you used to install it.\033[0m\n" "$nix_version" "$NIX_MIN_VERSION" >&2
      exit 1
    fi
  else
    printf "\nNix is not installed. Installing using the Determinate Systems installer..." >&2
  fi

  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix/tag/v0.38.1 | sh -s -- install --no-confirm
  # shellcheck disable=SC1091
  . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
}

# Check if the user has direnv installed. If not, install it via nix.
check_direnv() {
  if ! command -v direnv >/dev/null 2>&1; then
    printf "\ndirenv is not installed. Installing via Nix...\n" >&2

    set +e
    if ! logs=$(nix profile install nixpkgs#direnv --quiet 2>&1); then
      printf "  \033[31mError: Failed to install direnv.\033[0m\n" >&2
      printf "  \033[31mLogs: %s\033[0m\n" "$logs" >&2
      exit 1
    fi
    set -e

    printf "\n  \033[32mdirenv installed successfully!\033[0m\n" >&2

    shell_config=""
    if [ -f "$HOME/.zshrc" ]; then
      shell_config="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
      shell_config="$HOME/.bashrc"
    fi

    if [ -n "$shell_config" ]; then
      if ! grep -q "direnv hook" "$shell_config"; then
        # shellcheck disable=SC2016
        echo 'eval "$(direnv hook $(basename $SHELL))"' >>"$shell_config"
        printf "  \033[31mCRITICAL: Restart your shell or run 'source %s' to enable direnv.\033[0m\n" "$shell_config" >&2
        printf "  \033[31mThen, run this script again to install the rest of the dependencies.\033[0m\n\n" >&2
        exit 1
      fi
    else
      printf "  \033[31mCRITICAL:Please add the direnv hooks to your shell: https://direnv.net/docs/hook.html\033[0m\n" >&2
      printf "  \033[31mThen restart your shell to enable direnv.\033[0m\n" >&2
      printf "  \033[31mFinally, run this script again to install the rest of the dependencies.\033[0m\n\n" >&2
      exit 1
    fi
  else
    direnv_version=$(direnv version | awk '{print $NF}')

    if [ "$(printf '%s\n' "$DIRENV_MIN_VERSION" "$direnv_version" | sort -V | head -n1)" != "$DIRENV_MIN_VERSION" ]; then
      printf "  \033[31mdirenv version %s is installed, but version %s or higher is required. Upgrade direnv using the package manager that you used to install it.\033[0m\n" "$direnv_version" "$DIRENV_MIN_VERSION" >&2
    else
      printf "  \033[32mRequired direnv version %s is already installed.\033[0m\n" "$direnv_version" >&2

      shell_config=""
      if [ -f "$HOME/.zshrc" ]; then
        shell_config="$HOME/.zshrc"
      elif [ -f "$HOME/.bashrc" ]; then
        shell_config="$HOME/.bashrc"
      fi

      if [ -n "$shell_config" ]; then
        if ! grep -q "direnv hook" "$shell_config"; then
          # shellcheck disable=SC2016
          echo 'eval "$(direnv hook $(basename $SHELL))"' >>"$shell_config"
          printf "  \033[31mMissing direnv hook added to %s.\033[0m\n" "$shell_config" >&2
          printf "  \033[31mPlease restart your shell or run 'source %s' to enable direnv.\033[0m\n" "$shell_config" >&2
          printf "  \033[31mThen, run this script again to install the rest of the dependencies.\033[0m\n\n" >&2
          exit 1
        fi
      fi
    fi
  fi
}

check_git_repo() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf "  \033[31mError: Not inside a git repository.\033[0m\n" >&2
    printf "  \033[31mPlease run this script from within the git repository that will contain the infrastructure-as-code for your Panfactum deployment.\033[0m\n" >&2
    exit 1
  fi
}

get_repo_root() {
  git rev-parse --show-toplevel
}

create_flake_nix() {
  repo_root=$(get_repo_root)
  flake_path="$repo_root/flake.nix"

  if [ -f "$flake_path" ]; then

    if grep -q 'panfactum\.url = "github:panfactum/stack' "$flake_path"; then
      printf "  \033[32mExisting flake.nix already contains a Panfactum framework reference.\033[0m\n" >&2
      return 0
    fi

    printf "  \033[31mWarning: flake.nix already exists at %s.\033[0m\n" "$flake_path" >&2
    printf "  \033[31mThis automated installer expects to be able to create the repo's flake.nix file.\033[0m\n" >&2
    printf "  \033[31mPlease remove the flake.nix file and try again.\033[0m\n" >&2
    exit 1
  fi

  cat >"$flake_path" <<EOF
{
  inputs = {
     # Utility for generating flakes that are compatible with all operating systems
    flake-utils.url = "github:numtide/flake-utils";

    # The version of the Panfactum framework to use
    panfactum.url = "github:panfactum/stack/${VERSION}";
  };

  outputs = { panfactum, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem
    (system:
      {
        devShell = panfactum.lib.\${system}.mkDevShell { };
      }
    );
}
EOF
  git add "$flake_path"

  set +e
  if ! logs=$(nix flake update --quiet 2>&1); then
    printf "  \033[31mError: Failed to update flake.nix dependencies.\033[0m\n" >&2
    printf "  \033[31mLogs: %s\033[0m\n" "$logs" >&2
    exit 1
  fi
  set -e

  git add "$repo_root/flake.lock"
  printf "  \033[32mCreated flake.nix at %s\033[0m\n" "$flake_path" >&2
}

create_panfactum_yaml() {
  repo_root=$(get_repo_root)

  # Check if panfactum.yaml already exists and contains required keys
  panfactum_yaml_path="$repo_root/panfactum.yaml"

  if [ -f "$panfactum_yaml_path" ]; then
    # Check if the file contains all required keys
    has_repo_url=$(grep -q "repo_url:" "$panfactum_yaml_path" && echo "true" || echo "false")
    has_repo_name=$(grep -q "repo_name:" "$panfactum_yaml_path" && echo "true" || echo "false")
    has_repo_primary_branch=$(grep -q "repo_primary_branch:" "$panfactum_yaml_path" && echo "true" || echo "false")

    if [ "$has_repo_url" = "true" ] && [ "$has_repo_name" = "true" ] && [ "$has_repo_primary_branch" = "true" ]; then
      printf "  \033[32mExisting panfactum.yaml found with required configuration.\033[0m\n" >&2
      return 0
    fi
  fi

  # Get default values
  # Try to get values from git, but allow user to override
  default_repo_url=$(git config --get remote.origin.url || echo "")

  # Convert SSH URL to HTTPS if needed
  if echo "$default_repo_url" | grep -q "^git@"; then
    # Convert git@github.com:username/repo.git to https://github.com/username/repo.git
    default_repo_url=$(echo "$default_repo_url" | sed 's|git@\([^:]*\):\(.*\)|https://\1/\2|')
  fi

  # Ask for user input with defaults
  while true; do
    if [ -n "$default_repo_url" ]; then
      printf "\n  \033[33mEnter repository URL [%s]: \033[0m" "$default_repo_url"
    else
      printf "\n  \033[33mEnter repository URL: \033[0m"
    fi

    read -r input_repo_url </dev/tty
    repo_url=${input_repo_url:-$default_repo_url}

    # Validate that the URL starts with https:// and ends with .git
    if echo "$repo_url" | grep -q "^https://" && echo "$repo_url" | grep -q "\.git$"; then
      break
    else
      printf "  \033[31mRepository URL must start with \"https://\" and end with \".git\". Please try again.\033[0m\n\n" >&2
    fi
  done

  default_repo_name=$(basename -s .git "$repo_url" 2>/dev/null || echo "")
  if [ -n "$default_repo_name" ]; then
    printf "  \033[33mEnter repository name [%s]: \033[0m" "$default_repo_name"
  else
    printf "  \033[33mEnter repository name: \033[0m"
  fi

  read -r input_repo_name </dev/tty
  repo_name=${input_repo_name:-$default_repo_name}

  # Try to get the current branch name, fallback to "main" if it fails
  default_repo_primary_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
  printf "  \033[33mEnter primary branch [%s]: \033[0m" "$default_repo_primary_branch"
  read -r input_repo_primary_branch </dev/tty

  repo_primary_branch=${input_repo_primary_branch:-$default_repo_primary_branch}

  # Create the panfactum.yaml file
  cat >"$panfactum_yaml_path" <<EOF
# These are the standard repo variables required by
# https://panfactum.com/docs/reference/repo-variables

repo_url: git::${repo_url}
repo_name: ${repo_name}
repo_primary_branch: ${repo_primary_branch}
EOF

  git add "$panfactum_yaml_path"
  printf "\n  \033[32mCreated panfactum.yaml config file.\033[0m\n" >&2
}

run_pf_update() {
  export PF_SKIP_CHECK_REPO_SETUP=1

  # Start a background process to print a progress indicator every 10 seconds
  (
    i=0
    while true; do
      sleep 10
      i=$((i + 10))
      printf "  Still building... %d seconds elapsed\n" "$i" >&2
    done
  ) &
  progress_pid=$!

  # Make sure to kill the progress indicator when this function exits
  trap 'kill $progress_pid 2>/dev/null || true' EXIT

  set +e
  if ! logs=$(nix develop -c pf-update 2>&1); then
    # Kill the progress indicator
    kill $progress_pid 2>/dev/null || true
    trap - EXIT

    printf "  \033[31mError: Failed to build the Panfactum DevShell.\033[0m\n" >&2
    printf "  \033[31mLogs: %s\033[0m\n" "$logs" >&2
    return 1
  fi
  set -e

  # Kill the progress indicator
  kill $progress_pid 2>/dev/null || true
  trap - EXIT

  printf "\n  \033[32mSuccessfully built the Panfactum DevShell.\033[0m\n" >&2
  export PF_SKIP_CHECK_REPO_SETUP=0
}

###################################
# Main Runner
###################################
print_panfactum
check_platform

printf "Installing dependencies...\n\n"
check_git_version
check_nix_version
check_direnv

printf "\nSetting up infrastructure repository...\n\n"
check_git_repo
create_flake_nix
create_panfactum_yaml

printf "\nBuilding the Panfactum DevShell. This initial build may take up to 30 minutes to complete...\n" >&2
run_pf_update

printf "\nInstallation COMPLETE! Booting up the Panfactum DevShell...\n\n" >&2
repo_root=$(get_repo_root)
direnv allow "$repo_root/.envrc"
