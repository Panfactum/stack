// This file defines Zod schemas for validating Panfactum devshell configuration files
// These schemas ensure configuration files meet all required constraints

import { z } from "zod";

/**
 * Schema for validating panfactum.yaml devshell configuration files
 * 
 * @remarks
 * This schema validates the main Panfactum devshell configuration file.
 * It ensures all required fields are present and validates the format of
 * repository URLs and directory paths.
 * 
 * Directory paths must:
 * - Be relative (no leading slash)
 * - Not end with a slash
 * - Default to standard directory names if not specified
 * 
 * The repo_url must be a valid Terraform module source using HTTPS.
 * 
 * @example
 * ```typescript
 * const config = PANFACTUM_DEVSHELL_SCHEMA.parse({
 *   repo_name: "my-infrastructure",
 *   repo_primary_branch: "main",
 *   repo_url: "git::https://github.com/myorg/infrastructure.git",
 *   environments_dir: "envs",
 *   iac_dir: "modules"
 * });
 * ```
 * 
 * @see {@link getDevshellConfig} - Uses this schema to validate config files
 */
export const PANFACTUM_DEVSHELL_SCHEMA = z
    .object({
        // Required fields
        /** Name of the repository - used for identification and display */
        repo_name: z.string({
            required_error: "repo_name must be set in panfactum.yaml",
        }).describe("Repository name for identification"),

        /** Primary branch name (e.g., main, master) for the repository */
        repo_primary_branch: z.string({
            required_error: "repo_primary_branch must be set in panfactum.yaml",
        }).describe("Primary branch name for CI/CD operations"),

        /** Repository URL in Terraform module source format */
        repo_url: z
            .string({
                required_error: "repo_url must be set in panfactum.yaml",
            })
            .refine(
                (url) =>
                    url.startsWith("git::https://") ||
                    url.startsWith("github.com") ||
                    url.startsWith("bitbucket.org"),
                {
                    message:
                        "repo_url must be a valid TF module source that uses HTTPS. See https://opentofu.org/docs/language/modules/sources.",
                }
            )
            .describe("Repository URL for Terraform module sourcing"),

        // Optional directory fields with path validation
        /** Directory containing environment configurations (default: environments) */
        environments_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "environments_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "environments_dir must not contain a trailing /",
            })
            .default("environments")
            .describe("Relative path to environments directory"),

        /** Directory containing infrastructure-as-code modules (default: infrastructure) */
        iac_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "iac_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "iac_dir must not contain a trailing /",
            })
            .default("infrastructure")
            .describe("Relative path to IaC modules directory"),

        /** Directory for AWS configuration files (default: .aws) */
        aws_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "aws_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "aws_dir must not contain a trailing /",
            })
            .default(".aws")
            .describe("Relative path to AWS config directory"),

        /** Directory for Kubernetes configuration files (default: .kube) */
        kube_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "kube_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "kube_dir must not contain a trailing /",
            })
            .default(".kube")
            .describe("Relative path to Kubernetes config directory"),

        /** Directory for SSH keys and configuration (default: .ssh) */
        ssh_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "ssh_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "ssh_dir must not contain a trailing /",
            })
            .default(".ssh")
            .describe("Relative path to SSH config directory"),

        /** Directory for Buildkit configuration (default: .buildkit) */
        buildkit_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "buildkit_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "buildkit_dir must not contain a trailing /",
            })
            .default(".buildkit")
            .describe("Relative path to Buildkit config directory"),

        /** Directory for NATS messaging configuration (default: .nats) */
        nats_dir: z
            .string()
            .optional()
            .refine((dir) => !dir?.startsWith("/"), {
                message: "nats_dir must not contain a leading /",
            })
            .refine((dir) => !dir?.endsWith("/"), {
                message: "nats_dir must not contain a trailing /",
            })
            .default(".nats")
            .describe("Relative path to NATS config directory"),
        
        /** Unique installation identifier for analytics */
        installation_id: z.string().uuid().optional()
            .describe("UUID for tracking unique Panfactum installations"),
        
        /** User identifier for analytics */
        user_id: z.string().uuid().optional()
            .describe("UUID for tracking unique Panfactum users")
    })
    .describe("Panfactum devshell configuration schema")