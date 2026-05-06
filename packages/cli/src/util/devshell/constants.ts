
// This file defines constants for DevShell configuration
// It specifies expected .gitignore patterns and configuration file names for Panfactum

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

/**
 * Main devshell configuration file name
 * 
 * @remarks
 * This file contains the primary Panfactum devshell configuration for the repository,
 * including directory paths, environment settings, and other project-wide
 * configuration. It should be committed to version control.
 */
export const DEVSHELL_CONFIG_FILE = "panfactum.yaml"

/**
 * User-specific devshell configuration override file name
 * 
 * @remarks
 * This file allows individual developers to override repository settings
 * with their own preferences. It should be gitignored and not committed
 * to version control. Settings in this file take precedence over those
 * in the main config file.
 */
export const DEVSHELL_USER_CONFIG_FILE = "panfactum.user.yaml"