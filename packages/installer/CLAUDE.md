# CLAUDE.md - Installer Package

This file provides guidance to Claude Code when working with the installer package.

## Overview

The installer package contains a single shell script (`install.sh`) that automates the setup of a new Panfactum infrastructure repository. It handles all dependency installation and initial configuration required to start using the Panfactum framework.

## Key Components

### install.sh Script
A POSIX-compliant shell script that performs:
1. Platform verification (Linux, macOS, WSL2)
2. Dependency installation (Git, Nix, direnv)
3. Repository initialization (flake.nix, panfactum.yaml)
4. Initial DevShell build

## Workflow Steps

### 1. Platform Check
- Supports: Linux, macOS, Windows (WSL2 only)
- Rejects: WSL1, other platforms

### 2. Dependency Management
**Git**: Minimum version 2.39
**Nix**: Minimum version 2.23 (installs via Determinate Systems if missing)
**direnv**: Minimum version 2.32 (installs via Nix if missing)

### 3. Repository Setup
- Verifies script is run from within a git repository
- Creates `flake.nix` with Panfactum framework input
- Creates `panfactum.yaml` with repository metadata
- Stages both files for git commit

### 4. Configuration Collection
Interactive prompts for:
- **repo_url**: HTTPS git URL (validates format)
- **repo_name**: Repository name (defaults from URL)
- **repo_primary_branch**: Main branch name (defaults to current)

### 5. DevShell Build
- Runs `pf devshell sync` to build the development environment
- Shows progress indicator for long-running build
- Enables direnv for the repository

## Environment Variables

- `VERSION`: Panfactum stack version to install (default: "main")
- `PF_SKIP_CHECK_REPO_SETUP`: Internal flag to bypass repo checks

## Error Handling

The script uses `set -e` and provides colored output:
- 🟢 Green: Success messages
- 🟡 Yellow: User prompts
- 🔴 Red: Error messages

Common failure points:
- Unsupported platform
- Missing/outdated dependencies
- Not in a git repository
- Existing flake.nix conflicts
- Network issues during downloads

## Testing

```bash
# Test the installer in a new repository
mkdir test-repo && cd test-repo
git init
curl -sSfL https://panfactum.com/install | sh

# Test with existing dependencies
./install.sh

# Test platform detection
uname -s  # Should show Linux/Darwin
```

## Maintenance Notes

- **Version Pinning**: Update `VERSION` variable for new releases
- **Dependency Versions**: Update minimum version constants as needed
- **Nix Installer**: Pinned to Determinate Systems v0.38.1
- **Shell Compatibility**: Must remain POSIX-compliant (no bash-isms)

## Security Considerations

- Uses HTTPS for all downloads
- Validates git repository URLs
- No sudo/root operations required
- Creates files only in current repository
- Adds direnv hooks to user's shell config

## Integration

This installer is typically distributed via:
```bash
curl -sSfL https://panfactum.com/install | sh
```

The script is designed to be idempotent - running it multiple times should be safe and will skip already completed steps.