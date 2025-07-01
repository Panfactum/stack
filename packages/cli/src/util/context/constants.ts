// This file defines constants for Panfactum configuration file names
// These are used throughout the CLI to locate and load configuration

/**
 * Main repository configuration file name
 * 
 * @remarks
 * This file contains the primary Panfactum configuration for the repository,
 * including directory paths, environment settings, and other project-wide
 * configuration. It should be committed to version control.
 */
export const REPO_CONFIG_FILE = "panfactum.yaml"

/**
 * User-specific configuration override file name
 * 
 * @remarks
 * This file allows individual developers to override repository settings
 * with their own preferences. It should be gitignored and not committed
 * to version control. Settings in this file take precedence over those
 * in the main config file.
 */
export const REPO_USER_CONFIG_FILE = "panfactum.user.yaml"