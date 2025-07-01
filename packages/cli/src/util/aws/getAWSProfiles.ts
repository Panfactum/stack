import { join } from "node:path"
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/util/context/context";

export async function getAWSProfiles(context: PanfactumContext, opts: { throwOnMissingConfig?: boolean } = {}): Promise<string[]> {

    const configFilePath = join(context.repoVariables.aws_dir, "config")

    // Handles missing config file
    if (! await fileExists(configFilePath)) {
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
