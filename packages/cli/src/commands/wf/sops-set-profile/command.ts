// This file defines the wf sops-set-profile command for SOPS file management
// It updates AWS profiles in SOPS-encrypted files for CI/CD workflows

import { Glob } from 'bun';
import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import { writeYAMLFile } from '@/util/yaml/writeYAMLFile';

/**
 * Interface representing the result of a SOPS file update operation
 */
interface IUpdateResult {
  /** Path to the file that was processed */
  filePath: string;
  /** Status of the update operation */
  status: 'updated' | 'skipped' | 'error';
  /** Reason for skipping or error */
  reason?: string;
  /** Error object if status is 'error' */
  error?: Error;
}

/**
 * CLI command for updating AWS profiles in SOPS-encrypted files
 * 
 * @remarks
 * This command bulk-updates AWS profile references in SOPS metadata across
 * multiple encrypted files. It's designed for CI/CD environments where
 * different AWS profiles are needed for KMS access.
 * 
 * SOPS (Secrets OPerationS) is a tool for managing encrypted secrets
 * that integrates with AWS KMS, GCP KMS, Azure Key Vault, and PGP.
 * This command specifically targets the AWS KMS configuration.
 * 
 * Key features:
 * - Recursive directory scanning for YAML files
 * - Safe SOPS metadata updates without decryption
 * - Batch processing with detailed reporting
 * - Non-destructive (preserves all other content)
 * - Error handling with detailed diagnostics
 * 
 * Use cases:
 * - CI/CD pipelines with environment-specific profiles
 * - Migrating encrypted files between AWS accounts
 * - Standardizing profile names across repositories
 * - Automating profile updates during deployments
 * 
 * The command only modifies the SOPS metadata section,
 * specifically the aws_profile field in KMS configurations.
 * The encrypted data itself remains unchanged.
 * 
 * @example
 * ```bash
 * # Update all SOPS files in current directory
 * pf wf sops-set-profile . development
 * 
 * # Update files in specific environment directory
 * pf wf sops-set-profile environments/staging ci-staging-profile
 * 
 * # Use in CI pipeline
 * export CI_AWS_PROFILE=$(pf config get | jq -r .aws_profile)
 * pf wf sops-set-profile . "$CI_AWS_PROFILE"
 * 
 * # Typical workflow usage
 * cd /workspace
 * pf wf sops-set-profile . workflow-role
 * sops decrypt secrets.yaml > decrypted.yaml
 * ```
 * 
 * @see {@link readYAMLFile} - For safe YAML parsing
 * @see {@link writeYAMLFile} - For preserving YAML structure
 */
export class SopsSetProfileCommand extends PanfactumCommand {
  static override paths = [['wf', 'sops-set-profile']];

  static override usage = Command.Usage({
    description: 'Update AWS profile used for KMS access in SOPS files',
    category: 'Workflow',
    details: `Updates the AWS profile used to access KMS in all sops-encrypted YAML files in the indicated directory tree.
This can be used in CI pipelines to simplify access to encrypted files that would otherwise require many AWS profiles to be configured.`,
    examples: [
      ['Update profile in current directory', 'pf sops set-profile . development'],
      ['Update profile in specific directory', 'pf sops set-profile /path/to/dir production']
    ]
  });

  /**
   * Directory to search for SOPS files
   * 
   * @remarks
   * Searches recursively for all .yaml files.
   * Use absolute or relative paths.
   */
  directory = Option.String({ required: true });
  
  /**
   * AWS profile name to set
   * 
   * @remarks
   * Must match a configured AWS profile.
   * Replaces existing aws_profile values in SOPS metadata.
   */
  profile = Option.String({ required: true });

  /**
   * Executes the SOPS profile update process
   * 
   * @remarks
   * This method:
   * 1. Recursively finds all YAML files in the directory
   * 2. Checks each file for SOPS encryption metadata
   * 3. Updates aws_profile in KMS configurations
   * 4. Saves modified files preserving structure
   * 5. Reports detailed results and summary
   * 
   * The process is idempotent - running multiple times
   * with the same profile has no additional effect.
   * 
   * @throws {@link CLIError}
   * Throws when one or more files fail to update
   */
  async execute() {
    /**
     * Updates AWS profile in a single SOPS file
     * 
     * @internal
     */
    const updateSopsFile = async (filePath: string): Promise<IUpdateResult> => {
      try {
        const sopsFileSchema = z.object({
          sops: z.object({
            kms: z.array(z.record(z.string())).optional()
          }).optional()
        }).passthrough(); // Allow other fields in the YAML

        const data = await readYAMLFile({
          context: this.context,
          filePath,
          validationSchema: sopsFileSchema,
          throwOnMissing: false,
          throwOnEmpty: false
        });

        if (!data) {
          return {
            filePath,
            status: 'skipped',
            reason: 'File is empty or not a valid YAML file'
          };
        }
        
        if (!data.sops?.kms) {
          return {
            filePath,
            status: 'skipped',
            reason: 'Not a SOPS-encrypted file (no sops.kms section)'
          };
        }

        if (!Array.isArray(data.sops.kms)) {
          return {
            filePath,
            status: 'skipped',
            reason: 'Invalid SOPS format (kms is not an array)'
          };
        }

        let updated = false;
        for (const kms of data.sops.kms) {
          if ('aws_profile' in kms) {
            kms['aws_profile'] = this.profile;
            updated = true;
          }
        }

        if (!updated) {
          return {
            filePath,
            status: 'skipped',
            reason: 'No AWS profiles found in KMS configuration'
          };
        }

        await writeYAMLFile({
          context: this.context,
          filePath,
          values: data,
          overwrite: true
        });

        return {
          filePath,
          status: 'updated'
        };
      } catch (error) {
        return {
          filePath,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error occurred',
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    };

    this.context.logger.info(`Finding YAML files in ${this.directory}...`);
    
    const glob = new Glob("**/*.yaml");
    const yamlFiles: string[] = [];
    
    for await (const file of glob.scan({ cwd: this.directory, absolute: true })) {
      yamlFiles.push(file);
    }
    
    this.context.logger.info(`Updating SOPS-encrypted files with profile '${this.profile}'...`);
    
    const updateResults = await Promise.all(
      yamlFiles.map(updateSopsFile)
    );
    
    // Group results by status
    const updated = updateResults.filter(r => r.status === 'updated');
    const skipped = updateResults.filter(r => r.status === 'skipped');
    const errors = updateResults.filter(r => r.status === 'error');
    
    // Log individual results
    for (const result of updateResults) {
      if (result.status === 'updated') {
        this.context.logger.info(`✓ Updated: ${result.filePath}`);
      } else if (result.status === 'error') {
        this.context.logger.error(`✗ Error: ${result.filePath} - ${result.reason}`);
      }
    }
    
    // Summary
    this.context.logger.info('');
    if (updated.length > 0) {
      this.context.logger.success(`Successfully updated ${updated.length} SOPS-encrypted file${updated.length !== 1 ? 's' : ''}`);
    }
    
    if (skipped.length > 0) {
      this.context.logger.info(`Skipped ${skipped.length} file${skipped.length !== 1 ? 's' : ''} (not SOPS-encrypted or no AWS profiles)`);
    }
    
    if (errors.length > 0) {
      this.context.logger.warn(`Failed to update ${errors.length} file${errors.length !== 1 ? 's' : ''}`);
      for (const error of errors) {
        this.context.logger.debug(`  ${error.filePath}: ${error.reason}`);
      }
    }
    
    // Exit with error if any files failed
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `  - ${e.filePath}: ${e.reason}`).join('\n');
      throw new CLIError(`Failed to update sops ${errors.length} files:\n${errorMessages}`);
    }
  }
}