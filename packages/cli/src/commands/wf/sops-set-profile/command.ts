import { Glob } from 'bun';
import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import { writeYAMLFile } from '@/util/yaml/writeYAMLFile';

interface UpdateResult {
  filePath: string;
  status: 'updated' | 'skipped' | 'error';
  reason?: string;
  error?: Error;
}

export class SopsSetProfileCommand extends PanfactumCommand {
  static override paths = [['wf', 'sops-set-profile']];

  static override usage = Command.Usage({
    description: 'Update AWS profile used for KMS access in SOPS-encrypted YAML files',
    details: `Updates the AWS profile used to access KMS in all sops-encrypted YAML files in the indicated directory tree.
This can be used in CI pipelines to simplify access to encrypted files that would otherwise require many AWS profiles to be configured.`,
    examples: [
      ['Update profile in current directory', 'pf sops set-profile . development'],
      ['Update profile in specific directory', 'pf sops set-profile /path/to/dir production']
    ]
  });

  directory = Option.String({ required: true });
  profile = Option.String({ required: true });

  async execute() {
    const updateSopsFile = async (filePath: string): Promise<UpdateResult> => {
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