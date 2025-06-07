import { promises as fs } from 'fs';
import path from 'path';
import { Command, Option } from 'clipanion';
import yaml from 'yaml';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';

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
        const content = await fs.readFile(filePath, 'utf8');
        
        const sopsFileSchema = z.object({
          sops: z.object({
            kms: z.array(z.record(z.string())).optional()
          }).optional()
        }).passthrough(); // Allow other fields in the YAML
        
        const parsedYaml = yaml.parse(content);
        const data = sopsFileSchema.parse(parsedYaml);
        
        if (data?.sops?.kms && Array.isArray(data.sops.kms)) {
          let updated = false;
          for (const kms of data.sops.kms) {
            if ('aws_profile' in kms) {
              kms['aws_profile'] = this.profile;
              updated = true;
            }
          }
          
          if (updated) {
            const newContent = yaml.stringify(data);
            await fs.writeFile(filePath, newContent);
            return true;
          }
        }
      } catch {
        // Not a valid YAML or doesn't have SOPS metadata
      }
      return false;
    };

    const findYamlFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await findYamlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          files.push(fullPath);
        }
      }
      
      return files;
    };

    this.context.logger.info(`Finding YAML files in ${this.directory}...`);
    const yamlFiles = await findYamlFiles(this.directory);
    
    this.context.logger.info(`Updating SOPS-encrypted files with profile '${this.profile}'...`);
    const updatedFiles: string[] = [];
    for (const file of yamlFiles) {
      if (await updateSopsFile(file)) {
        updatedFiles.push(file);
        this.context.logger.info(`Updated: ${file}`);
      }
    }
    
    if (updatedFiles.length > 0) {
      this.context.logger.success(`Updated ${updatedFiles.length} SOPS-encrypted files`);
    } else {
      this.context.logger.info('No SOPS-encrypted files found to update');
    }
  }
}