Every folder in this directory is an infrastructure module.

# Guidelines

1. Run `tofu fmt` against any module updates.
2. When a new module is created or the variables or outputs of a module change,
run `generate-tf`.

# Modules

## Structure Patterns

Each infrastructure module follows consistent structure:

- `main.tf` - Primary Terraform configuration
- `vars.tf` - Variable definitions
- `outputs.tf` - Output values
- `config.yaml` - Module configuration
- `README.md` - Module documentation
- `FOOTER.md` - Additional documentation

## Module Types

Modules are categorized in `config.yaml`:

**Type:**
- `direct` - Can be deployed directly via Terragrunt
- `submodule` - Utility module called by other modules, not deployed directly

**Status:**
- `stable` - Production-ready
- `beta` - Feature complete but may have issues
- `alpha` - Under active development

**Group:**
- `aws` - AWS resource modules (VPC, EKS, S3, etc.)
- `kubernetes` - Kubernetes resource modules (Deployments, Services, etc.)
- `authentication` - Auth-related modules (Authentik, Vault, SSO)