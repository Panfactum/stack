// This file provides utilities for extracting AWS profile names from config files
// It parses the AWS config file to find all configured profiles

import { join } from "node:path"
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Options for getting AWS profiles
 */
interface IGetAWSProfilesOptions {
    /** Whether to throw an error if the config file is missing */
    throwOnMissingConfig?: boolean;
}

/**
 * Retrieves all AWS profile names from the AWS config file
 * 
 * @remarks
 * This function parses the AWS config file to extract all profile names,
 * including the default profile. Profile names are extracted from section
 * headers in the INI-formatted config file. The results are sorted
 * alphabetically for consistent ordering.
 * 
 * @param context - Panfactum context for logging and configuration
 * @param opts - Options for controlling error behavior
 * @returns Array of profile names, sorted alphabetically
 * 
 * @example
 * ```typescript
 * const profiles = await getAWSProfiles(context);
 * console.log(profiles); // ['default', 'dev', 'prod', 'staging']
 * ```
 * 
 * @example
 * ```typescript
 * // Throw error if config file doesn't exist
 * const profiles = await getAWSProfiles(context, {
 *   throwOnMissingConfig: true
 * });
 * ```
 * 
 * @throws {@link CLIError}
 * Throws when config file is missing and throwOnMissingConfig is true
 * 
 * @throws {@link CLIError}
 * Throws when unable to read or parse the AWS config file
 * 
 * @see {@link fileExists} - For checking config file existence
 */
export async function getAWSProfiles(context: PanfactumContext, opts: IGetAWSProfilesOptions = {}): Promise<string[]> {

    const configFilePath = join(context.devshellConfig.aws_dir, "config")

    // Handles missing config file
    if (! await fileExists({ filePath: configFilePath })) {
        if (opts.throwOnMissingConfig) {
            throw new CLIError(`Cannot get AWS profiles as AWS config file at ${configFilePath} does not exist`)
        }
        return []
    }

    const awsConfigFile = Bun.file(configFilePath);

    try {

        const awsConfigText = await awsConfigFile.text();
        const profileMatches = awsConfigText.match(/^\[(profile\s+([^\]]+)|default)\]$/gm) || [];
        return profileMatches.map(match => {
            if (match === '[default]') {
                return 'default';
            }
            return match.replace(/^\[profile\s+([^\]]+)\]$/, '$1');
        }).sort();
    } catch (e) {
        throw new CLIError(`Failed to get AWS profiles from ${configFilePath}:`, e)
    }
}
