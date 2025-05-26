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