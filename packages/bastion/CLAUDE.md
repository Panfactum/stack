# CLAUDE.md - Bastion Package

This file provides guidance to Claude Code when working with the bastion package.

## Overview

The bastion package provides a secure SSH bastion host container image for enabling controlled SSH tunneling into Kubernetes clusters. It acts as a secure entry point without providing shell access, using certificate-based authentication via Vault CA.

## Key Files

- **Containerfile**: Defines the minimal Debian-based container with OpenSSH server
- **sshd_config**: SSH daemon configuration with strict security settings
- **scripts/**: Build and deployment scripts for container management

## Commands

### Building the Container
```bash
# Build the container image
./scripts/build-image.sh

# Build with custom tag
./scripts/build-image.sh custom-tag

# Build specific target
./scripts/build-image.sh tag target
```

### Pushing to Registry
```bash
# Push to GitHub Container Registry
./scripts/push-image.sh

# Push with custom tag
./scripts/push-image.sh custom-tag
```

### Build and Push Combined
```bash
# Build and push in one command
./scripts/build-and-push-image.sh

# With custom tag
./scripts/build-and-push-image.sh custom-tag
```

## Architecture

### Container Structure
- Base: Debian Bookworm (minimal)
- User: `panfactum` (UID/GID 1000)
- SSH Port: 2222
- No shell access (ForceCommand: /sbin/nologin)

### Security Configuration
- **Authentication**: Certificate-based only (TrustedUserCAKeys)
- **Restrictions**: No root login, no password auth, no X11/agent forwarding
- **Allowed**: TCP port forwarding and gateway ports
- **Logging**: Verbose logging at INFO level

### Integration
- Deployed via `kube_bastion` Terraform module
- Image hosted at: `ghcr.io/panfactum/bastion`
- Works with Vault for SSH certificate management

## Development Workflow

1. Modify Containerfile or sshd_config as needed
2. Test build locally: `./scripts/build-image.sh test`
3. Verify SSH configuration is secure
4. Push to registry after testing
5. Update `kube_bastion` module if interface changes

## Testing

```bash
# Build test image
./scripts/build-image.sh test

# Run container locally
podman run -d -p 2222:2222 ghcr.io/panfactum/bastion:test

# Test SSH connection (requires valid certificate)
ssh -p 2222 -i cert-key panfactum@localhost -N -L 8080:internal-service:80
```

## Important Notes

- Never enable shell access or password authentication
- Always use certificate-based authentication
- Keep the container minimal - no additional packages
- Port 2222 is intentionally non-standard for security
- The bastion is only for port forwarding, not interactive access