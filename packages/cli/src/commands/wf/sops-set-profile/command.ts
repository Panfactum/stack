import { Glob } from 'bun';
import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { readYAMLFile } from '@/util/yaml/readYAMLFile';
import { writeYAMLFile } from '@/util/yaml/writeYAMLFile';

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
    const updateSopsFile = async (filePath: string): Promise<boolean> => {
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
          return false;
        }
        
        if (data?.sops?.kms && Array.isArray(data.sops.kms)) {
          let updated = false;
          for (const kms of data.sops.kms) {
            if ('aws_profile' in kms) {
              kms['aws_profile'] = this.profile;
              updated = true;
            }
          }
          
          if (updated) {
            await writeYAMLFile({
              context: this.context,
              filePath,
              values: data,
              overwrite: true
            });
            return true;
          }
        }
      } catch {
        // Not a valid YAML or doesn't have SOPS metadata
      }
      return false;
    };

    this.context.logger.info(`Finding YAML files in ${this.directory}...`);
    
    const glob = new Glob("**/*.yaml");
    const yamlFiles: string[] = [];
    
    for await (const file of glob.scan({ cwd: this.directory, absolute: true })) {
      yamlFiles.push(file);
    }
    
    this.context.logger.info(`Updating SOPS-encrypted files with profile '${this.profile}'...`);
    
    const updateResults = await Promise.all(
      yamlFiles.map(async (file) => {
        const updated = await updateSopsFile(file);
        if (updated) {
          this.context.logger.info(`Updated: ${file}`);
        }
        return { file, updated };
      })
    );
    
    const updatedFiles = updateResults
      .filter(result => result.updated)
      .map(result => result.file);
    
    if (updatedFiles.length > 0) {
      this.context.logger.success(`Updated ${updatedFiles.length} SOPS-encrypted files`);
    } else {
      this.context.logger.info('No SOPS-encrypted files found to update');
    }
  }
}