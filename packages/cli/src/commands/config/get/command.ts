// This file defines the config get command for retrieving Panfactum configuration
// It merges environment, region, and repository configurations for debugging

import { resolve } from "node:path";
import { Command, Option } from "clipanion";
import { PanfactumCommand } from "@/util/command/panfactumCommand";
import { CLIError } from "@/util/error/error";
import { getPanfactumConfig } from "../../../util/config/getPanfactumConfig";

/**
 * CLI command for retrieving merged Panfactum configuration
 * 
 * @remarks
 * This command displays the complete configuration that applies to a
 * directory, merging all configuration sources in precedence order.
 * It's essential for debugging configuration issues and understanding
 * which settings are active.
 * 
 * Configuration sources (in order of precedence):
 * 1. User-specific overrides (*.user.yaml)
 * 2. Environment configuration (global.yaml, environment.yaml)
 * 3. Region configuration (region.yaml)
 * 4. Repository variables (panfactum.yaml)
 * 
 * The output includes:
 * - AWS profiles and regions
 * - Kubernetes contexts
 * - Vault addresses
 * - SSH bastion configurations
 * - Custom environment variables
 * - Repository paths and settings
 * 
 * Common use cases:
 * - Debugging configuration precedence
 * - Verifying environment settings
 * - Troubleshooting authentication issues
 * - Understanding active configuration
 * 
 * @example
 * ```bash
 * # Get configuration for current directory
 * pf config get
 * 
 * # Get configuration for specific environment
 * pf config get --directory environments/production
 * 
 * # Pretty print configuration
 * pf config get | jq .
 * 
 * # Check specific value
 * pf config get | jq .aws_profile
 * ```
 * 
 * @see {@link getPanfactumConfig} - Configuration loading logic
 */
export class ConfigGetCommand extends PanfactumCommand {
    static override paths = [["config", "get"]];

    static override usage = Command.Usage({
        description: "Gets the Panfactum configuration",
        category: 'Config',
        details:
            "Returns the Panfactum configuration",
    });

    /** Directory to get configuration for (defaults to current directory) */
    directory: string | undefined = Option.String("--directory,-d", {
        description: "Get the configuration of this directory (instead of the CWD)",
        arity: 1,
    });

    /**
     * Executes the configuration retrieval
     * 
     * @remarks
     * Loads and merges all applicable configuration files for the
     * specified directory, then outputs the result as formatted JSON.
     * The output includes both Panfactum config and repository variables.
     * 
     * @returns Exit code (0 for success)
     * 
     * @throws {@link CLIError}
     * Throws when the directory is outside the repository
     */
    async execute() {
        const directory = this.directory ? resolve(this.directory) : process.cwd()

        if (!directory.startsWith(this.context.repoVariables.repo_root)) {
            throw new CLIError(`Provided directory ${directory} is not inside the repository.`)
        }

        const mergedConfig = {
            ...await getPanfactumConfig({ context: this.context, directory }),
            ...this.context.repoVariables
        }
        this.context.stdout.write(JSON.stringify(mergedConfig, undefined, 4))
        return 0
    }
}


