
// This file defines constants for DevShell configuration
// It specifies expected .gitignore patterns for various Panfactum directories

/**
 * Expected .gitignore contents for Panfactum directories
 * @remarks Ensures sensitive files and generated content are not committed to version control
 */
export const EXPECTED_GITIGNORE_CONTENTS = {
    /** AWS configuration directory - ignore all except config file */
    aws: [
        "*",
        "!config",
        "!.gitignore"
    ],
    /** Environments directory - ignore user-specific YAML files */
    environments: [
        "*.user.yaml"
    ],
    /** Kubernetes configuration - ignore all except clusters config */
    kube: [
        "*",
        "!clusters.yaml",
        "!.gitignore"
    ],
    /** SSH directory - ignore all except connection info and known hosts */
    ssh: [
        "*",
        "!.gitignore",
        "!connection_info",
        "!known_hosts"
    ],
    /** Repository root - ignore development and temporary files */
    root: [
        ".devenv",
        ".terraform",
        ".env",
        ".terragrunt-cache",
        ".direnv",
        ".terraformrc",
        ".terraformrc.dev",
        ".nats",
        "*.user.yaml",
    ]
}