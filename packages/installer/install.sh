#!/usr/bin/env sh

set -e

# Check that the user is running on a supported platform
check_platform() {
  case "$(uname -s)" in
    Linux*)
      # Check if running in WSL
      if grep -q Microsoft /proc/version 2>/dev/null; then
        # Check WSL version
        if grep -q "WSL2" /proc/version 2>/dev/null || [ -n "$(uname -r | grep -i "WSL2")" ]; then
          printf "Running on WSL2. Continuing installation...\n" >&2
        else
          printf "\033[31mYou appear to be running WSL version 1. Please upgrade to WSL2 to continue.\033[0m\n" >&2
          exit 1
        fi
      else
        printf "Running on Linux. Continuing installation...\n\n" >&2
      fi
      ;;
    Darwin*)
      printf "Running on macOS. Continuing installation...\n\n" >&2
      ;;
    *)
      printf "\033[31mUnsupported platform: %s\033[0m\n" "$(uname -s)" >&2
      printf "\033[31mThis installer only supports Linux, macOS, or Windows with WSL2.\033[0m\n" >&2
      exit 1
      ;;
  esac
}

# Check that the users has at least version 2.40 of git installed
check_git_version() {
  if ! command -v git >/dev/null 2>&1; then
    printf "\033[31mGit is not installed. Please install Git version 2.40 or higher.\033[0m\n" >&2
    exit 1
  fi
  
  git_version=$(git --version | awk '{print $NF}')
  required_version="2.40"
  
  if [ "$(printf '%s\n' "$required_version" "$git_version" | sort -V | head -n1)" != "$required_version" ]; then
    printf "  \033[31mGit version %s is installed, but version %s or higher is required.\033[0m\n" "$git_version" "$required_version" >&2
    exit 1
  fi
  
  printf "  \033[32mRequired Git version %s is already installed.\033[0m\n" "$git_version" >&2
}

# Check that at least version 2.23 of nix is installed. If not, run the determinate installer.
check_nix_version() {
  if command -v nix >/dev/null 2>&1; then
    nix_version=$(nix --version | awk '{print $NF}')
    required_version="2.23"
    
    if [ "$(printf '%s\n' "$required_version" "$nix_version" | sort -V | head -n1)" = "$required_version" ]; then
      printf "  \033[32mRequired Nix version %s is already installed.\033[0m\n" "$nix_version" >&2
      return 0
    else
      printf "  \033[31mNix version %s is installed, but version %s or higher is required. Upgrade Nix using the package manager that you used to install it.\033[0m\n" "$nix_version" "$required_version" >&2
      exit 1
    fi
  else
    echo "Nix is not installed. Installing using the Determinate Systems installer..." >&2
  fi
  
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --determinate=false --no-confirm --force
}

# Check if the user has direnv installed. If not, install it via nix.
check_direnv() {
  if ! command -v direnv >/dev/null 2>&1; then
    printf "  direnv is not installed. Installing via Nix..." >&2
    nix-env -iA nixpkgs.direnv
    
    # Add direnv hook to shell configuration if not already present
    shell_config=""
    if [ -n "$BASH_VERSION" ]; then
      shell_config="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
      shell_config="$HOME/.zshrc"
    fi
    
    if [ -n "$shell_config" ] && [ -f "$shell_config" ]; then
      if ! grep -q "direnv hook" "$shell_config"; then
        # shellcheck disable=SC2016
        echo 'eval "$(direnv hook $(basename $SHELL))"' >> "$shell_config"
        printf "  \033[31mPlease restart your shell or run 'source %s' to enable direnv.\033[0m\n" "$shell_config" >&2
        printf "  \033[31mThen, run this script again to install the rest of the dependencies.\033[0m\n" >&2
        exit 1
      fi
    else
      # shellcheck disable=SC2059
      printf "  \033[31mPlease add 'eval \"$(direnv hook %s)\"' to your shell configuration file.\033[0m\n" "$(basename "$SHELL")" >&2
      printf "  \033[31mThen restart your shell to enable direnv.\033[0m\n" >&2
      printf "  \033[31mFinally, run this script again to install the rest of the dependencies.\033[0m\n" >&2
      exit 1
    fi
  else
    direnv_version=$(direnv version | awk '{print $NF}')
    required_version="2.32"
    
    if [ "$(printf '%s\n' "$required_version" "$direnv_version" | sort -V | head -n1)" != "$required_version" ]; then
      printf "  \033[31mdirenv version %s is installed, but version %s or higher is required. Upgrade direnv using the package manager that you used to install it.\033[0m\n" "$direnv_version" "$required_version" >&2
    else
      printf "  \033[32mRequired direnv version %s is already installed.\033[0m\n" "$direnv_version" >&2
    fi
  fi
}

check_git_repo() {
  if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
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
    printf "  \033[31mWarning: flake.nix already exists at %s.\033[0m\n" "$flake_path" >&2
    printf "  \033[31mThis automated installer expects to be able to create the repo's flake.nix file.\033[0m\n" >&2
    printf "  \033[31mPlease remove the flake.nix file and try again.\033[0m\n" >&2
    exit 1
  fi
  
  cat > "$flake_path" << 'EOF'
{
  inputs = {
     # Utility for generating flakes that are compatible with all operating systems
    flake-utils.url = "github:numtide/flake-utils";

    # Make sure this matches your version of the Panfactum Stack
    panfactum.url = "github:panfactum/stack/edge.25-04-03";
  };

  outputs = { panfactum, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem
    (system:
      {
        devShell = panfactum.lib.${system}.mkDevShell { };
      }
    );
}
EOF
  git add "$flake_path"

  set +e
  logs=$(nix flake update --quiet 2>&1)
  # shellcheck disable=SC2181
  if [ $? -ne 0 ]; then
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

  # Get default values
  # Try to get values from git, but allow user to override
  default_repo_url=$(git config --get remote.origin.url || echo "")  
  # Ask for user input with defaults
  if [ -n "$default_repo_url" ]; then
    printf "  Enter repository URL [%s]: " "$default_repo_url"
  else
    printf "  Enter repository URL: "
  fi
  read -r input_repo_url
  repo_url=${input_repo_url:-$default_repo_url}
  

  default_repo_name=$(basename -s .git "$default_repo_url" 2>/dev/null || echo "")
  if [ -n "$default_repo_name" ]; then
    printf "  Enter repository name [%s]: " "$default_repo_name"
  else
    printf "  Enter repository name: "
  fi
  read -r input_repo_name
  repo_name=${input_repo_name:-$default_repo_name}
  

  # Try to get the current branch name, fallback to "main" if it fails
  default_repo_primary_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "main")
  printf "  Enter primary branch [%s]: " "$default_repo_primary_branch"
  read -r input_repo_primary_branch
  repo_primary_branch=${input_repo_primary_branch:-$default_repo_primary_branch}
  
  # Create the panfactum.yaml file
  cat > "$repo_root/panfactum.yaml" << EOF
# These are the standard repo variables required by
# https://panfactum.com/docs/reference/repo-variables

repo_url: git::${repo_url}
repo_name: ${repo_name}
repo_primary_branch: ${repo_primary_branch}
EOF

  git add "$repo_root/panfactum.yaml"
  printf "\n  \033[32mCreated panfactum.yaml config file.\033[0m\n" >&2
}


###################################3
# Main Runner  
###################################3
check_platform

printf "Installing dependencies...\n\n"
check_git_version
check_nix_version
check_direnv

printf "\nSetting up infrastructure repository...\n\n"
check_git_repo
#create_flake_nix
create_panfactum_yaml
