# CLAUDE.md - Vault Package

This file provides guidance to Claude Code when working with the vault package.

## Overview

The vault package provides a custom HashiCorp Vault container image enhanced with additional plugins for the Panfactum stack. It extends the official Vault image with third-party secret engine plugins.

## Key Components

### Containerfile
- Base image: `hashicorp/vault:1.14.7`
- Adds vault-plugin-secrets-nats for NATS credentials management
- Multi-architecture support (via TARGETARCH)
- Published to GitHub Container Registry

## Architecture

### Plugin System
The image includes additional Vault plugins:
1. **vault-plugin-secrets-nats** (v1.7.0)
   - Manages NATS credentials dynamically
   - Downloaded from edgefarm/vault-plugin-secrets-nats releases
   - SHA256 verification for security
   - Installed to `/plugins` directory

### Multi-Architecture Support
- Supports both AMD64 and ARM64 architectures
- Uses Docker buildx TARGETARCH variable
- Downloads architecture-specific plugin binaries

## Commands

### Building the Image
```bash
# Build for current architecture
docker build -t vault-panfactum .

# Build for specific architecture
docker buildx build --platform linux/amd64 -t vault-panfactum .

# Build multi-arch and push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/panfactum/vault:latest \
  --push .
```

### Running the Container
```bash
# Run with default configuration
docker run -d \
  -p 8200:8200 \
  -e VAULT_DEV_ROOT_TOKEN_ID=root \
  ghcr.io/panfactum/vault:latest

# Run with custom plugin directory
docker run -d \
  -p 8200:8200 \
  -v /path/to/plugins:/plugins \
  ghcr.io/panfactum/vault:latest
```

## Plugin Configuration

After starting Vault, register the NATS plugin:
```bash
# Enable the plugin
vault write sys/plugins/catalog/secret/nats \
  sha256=$(sha256sum /plugins/vault-plugin-secrets-nats | cut -d' ' -f1) \
  command="vault-plugin-secrets-nats"

# Mount the secrets engine
vault secrets enable -path=nats nats
```

## Integration

This image is used by the `kube_vault` Terraform module which:
- Deploys Vault in HA mode on Kubernetes
- Configures the plugins automatically
- Sets up authentication backends
- Manages secret engines

## Security Considerations

- Plugin binaries are verified via SHA256 checksums
- Downloads use HTTPS from official GitHub releases
- Base image uses specific version tag (not latest)
- Runs as non-root user (inherited from base image)

## Maintenance

### Updating Vault Version
1. Update base image tag in Containerfile
2. Test plugin compatibility
3. Update kube_vault module if needed

### Updating Plugins
1. Check for new plugin releases
2. Update download URLs and SHA256 verification
3. Test plugin functionality
4. Consider backward compatibility

## Testing

```bash
# Build test image
docker build -t vault-test .

# Run in dev mode
docker run --rm -it \
  -p 8200:8200 \
  -e VAULT_DEV_ROOT_TOKEN_ID=test \
  vault-test

# Verify plugin installation
docker exec -it <container-id> ls -la /plugins/

# Test plugin registration
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=test
vault write sys/plugins/catalog/secret/nats \
  sha256=$(docker exec <container-id> sha256sum /plugins/vault-plugin-secrets-nats | cut -d' ' -f1) \
  command="vault-plugin-secrets-nats"
```

## Important Notes

- This image is specifically tailored for Panfactum's infrastructure needs
- Additional plugins can be added following the same pattern
- The image maintains compatibility with standard Vault operations
- Plugin versions should be kept in sync with Panfactum requirements