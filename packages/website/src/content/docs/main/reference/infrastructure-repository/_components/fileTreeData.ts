export interface IFileTreeNode {
  name: string;
  type: "file" | "directory";
  description?: string;
  detail?: string;
  children?: IFileTreeNode[];
  defaultOpen?: boolean;
  placeholder?: boolean;
}

export const INFRA_REPO_TREE: IFileTreeNode[] = [
  {
    name: "environments",
    type: "directory",
    description: "Configuration-as-code for all deployments",
    detail:
      "Contains all deployed infrastructure configuration-as-code for every environment. Organized as a three-level hierarchy: environment > region > module. Configuration is layered via YAML files at each level, with more specific values overriding less specific ones.",
    defaultOpen: true,
    children: [
      {
        name: "global.yaml",
        type: "file",
        description: "Variables shared across all environments",
        detail:
          "Terragrunt variables that apply to every environment, region, and module. Values here have the lowest precedence and are overridden by environment.yaml, region.yaml, and module.yaml.",
      },
      {
        name: "panfactum.hcl",
        type: "file",
        description: "Root Terragrunt configuration",
        detail:
          "The root Terragrunt configuration file provided by the Panfactum framework. Included automatically by each module's terragrunt.hcl via include blocks. Defines standard provider configurations, backend settings, and input variable resolution.",
      },
      {
        name: "providers",
        type: "directory",
        description: "Terragrunt provider templates",
        detail:
          "Contains HCL template files (.tftpl) that define how Terraform providers are configured. Terragrunt renders these templates with variables from the YAML configuration hierarchy and injects them into each module.",
        children: [
          {
            name: "aws.tftpl",
            type: "file",
            description: "AWS provider template",
            detail:
              "Template for the AWS Terraform provider. Configures the region, authentication, and default tags based on the deployment context.",
          },
          {
            name: "kubernetes.tftpl",
            type: "file",
            description: "Kubernetes provider template",
            detail:
              "Template for the Kubernetes Terraform provider. Configures cluster connection settings based on the target EKS cluster.",
          },
        ],
      },
      {
        name: "<environment>",
        type: "directory",
        description: "e.g., production, staging, development",
        detail:
          "Each environment directory corresponds to a logical separation of your infrastructure, typically aligned with your SDLC (e.g., development, staging, production). Each environment usually maps to a separate AWS account.",
        placeholder: true,
        defaultOpen: true,
        children: [
          {
            name: "environment.yaml",
            type: "file",
            description: "Environment-scoped variables",
            detail:
              "Terragrunt variables scoped to this environment. Overrides values from global.yaml. Commonly sets the AWS account ID, environment name, and environment-wide feature flags.",
          },
          {
            name: "environment.user.yaml",
            type: "file",
            description: "User-specific overrides (not committed)",
            detail:
              "Optional per-user overrides for this environment. Not committed to version control. Each developer can customize settings for local development without affecting the shared configuration.",
          },
          {
            name: "<region>",
            type: "directory",
            description: "e.g., us-east-2",
            detail:
              "Each region directory represents a physical deployment location, typically an AWS region. A single environment can span multiple regions for redundancy or latency optimization.",
            placeholder: true,
            defaultOpen: true,
            children: [
              {
                name: "region.yaml",
                type: "file",
                description: "Region-scoped variables",
                detail:
                  "Terragrunt variables scoped to this region within its parent environment. Overrides values from environment.yaml. Commonly sets the AWS region and any region-specific provider configuration.",
              },
              {
                name: "region.user.yaml",
                type: "file",
                description: "User-specific overrides (not committed)",
                detail:
                  "Optional per-user overrides for this region. Not committed to version control. Useful for pointing at different clusters or using alternate credentials during development.",
              },
              {
                name: "<module>",
                type: "directory",
                description: "A deployed infrastructure module",
                detail:
                  "Each module directory represents a single deployment of an infrastructure module (either a Panfactum built-in or a first-party module from the infrastructure/ directory). The directory name becomes the module's deployment identifier.",
                placeholder: true,
                children: [
                  {
                    name: "module.yaml",
                    type: "file",
                    description: "Module-specific variables",
                    detail:
                      "Terragrunt variables scoped to this specific module deployment. Has the highest precedence, overriding all other YAML configuration layers. Used to set module input variables and deployment-specific settings.",
                  },
                  {
                    name: "terragrunt.hcl",
                    type: "file",
                    description: "Module Terragrunt configuration",
                    detail:
                      "The Terragrunt configuration for this module deployment. Specifies which Terraform module source to deploy and includes the root panfactum.hcl. This is the entry point that Terragrunt uses when running plan/apply.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "infrastructure",
    type: "directory",
    description: "First-party infrastructure modules",
    detail:
      "Houses custom OpenTofu / Terraform modules that you author. Each subdirectory is a self-contained module that can be referenced from your environment deployments via terragrunt.hcl source directives.",
    children: [
      {
        name: "<module>",
        type: "directory",
        description: "A custom OpenTofu / Terraform module",
        detail:
          "A first-party infrastructure module. Contains standard Terraform files (main.tf, vars.tf, outputs.tf) and can use any Panfactum submodules. Referenced by terragrunt.hcl files in the environments directory.",
        placeholder: true,
        children: [
          {
            name: "main.tf",
            type: "file",
            description: "Primary resource definitions",
            detail:
              "The main Terraform configuration file containing resource, data source, and module block definitions. For complex modules, resources may be split across multiple .tf files.",
          },
          {
            name: "vars.tf",
            type: "file",
            description: "Input variable declarations",
            detail:
              "Declares all input variables for the module. These variables are populated by Terragrunt from the YAML configuration hierarchy and any explicit inputs in terragrunt.hcl.",
          },
          {
            name: "outputs.tf",
            type: "file",
            description: "Output value declarations",
            detail:
              "Declares output values that other modules can reference via Terragrunt dependency blocks. Used to pass information between module deployments (e.g., VPC IDs, cluster endpoints).",
          },
        ],
      },
    ],
  },
  {
    name: ".aws",
    type: "directory",
    description: "AWS CLI configuration (auto-generated)",
    detail:
      "Auto-generated by the Panfactum devShell. Contains AWS CLI configuration and credential files. Should not be edited manually — managed by pf-update-aws.",
  },
  {
    name: ".kube",
    type: "directory",
    description: "Kubernetes configuration (auto-generated)",
    detail:
      "Auto-generated by the Panfactum devShell. Contains kubeconfig files for connecting to your EKS clusters. Should not be edited manually — managed by pf-update-kube.",
  },
  {
    name: ".ssh",
    type: "directory",
    description: "SSH configuration (auto-generated)",
    detail:
      "Auto-generated by the Panfactum devShell. Contains SSH configuration for connecting to bastion hosts and other infrastructure. Should not be edited manually — managed by pf-update-ssh.",
  },
  {
    name: ".buildkit",
    type: "directory",
    description: "BuildKit configuration (auto-generated)",
    detail:
      "Auto-generated by the Panfactum devShell. Contains BuildKit client configuration for connecting to remote build clusters. Should not be edited manually — managed by pf-update-buildkit.",
  },
  {
    name: ".nats",
    type: "directory",
    description: "NATS credentials (auto-generated)",
    detail:
      "Auto-generated by the Panfactum devShell. Contains NATS client credentials for connecting to the NATS messaging system. Should not be edited manually.",
  },
  {
    name: "flake.nix",
    type: "file",
    description: "Nix flake defining the development shell",
    detail:
      "The Nix flake that defines your development shell. Imports the Panfactum devShell and allows you to customize it with additional packages, scripts, and shell hooks.",
  },
  {
    name: "flake.lock",
    type: "file",
    description: "Pinned Nix flake dependencies",
    detail:
      "Lock file that pins exact versions of all Nix flake inputs, including the Panfactum stack version. Updated when you run nix flake update or change the flake.nix inputs.",
  },
  {
    name: "panfactum.yaml",
    type: "file",
    description: "Repository-level Panfactum configuration",
    detail:
      "The top-level Panfactum configuration file. Defines repository metadata (repo_name, repo_url, repo_primary_branch) and customizable directory paths (environments_dir, iac_dir, aws_dir, etc.).",
  },
  {
    name: ".envrc",
    type: "file",
    description: "direnv configuration to auto-activate the devShell",
    detail:
      "Configuration for direnv that automatically activates the Nix development shell when you enter the repository directory. Ensures all Panfactum CLI tools and environment variables are available.",
  },
  {
    name: ".gitignore",
    type: "file",
    description: "Files excluded from version control",
    detail:
      "Specifies files and directories that should not be committed to git. Typically excludes auto-generated config directories (.aws/, .kube/, etc.), user-specific YAML overrides (*.user.yaml), and Terraform state files.",
  },
];
