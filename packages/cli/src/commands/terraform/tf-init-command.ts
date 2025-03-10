import { Command } from 'clipanion';

import { initTerraformModules } from './init-terraform-modules';

/**
 * CLI command to initialize and upgrade all Terraform modules
 * with provider locks for all major platforms
 */
export class TerraformInitCommand extends Command {
  static override paths = [['tf', 'init']];
  
  static override usage = Command.Usage({
    description: 'Initialize and upgrade all Terraform modules, and update platform locks',
    details: 
      'This command performs two operations:\n' +
      '1. Runs terraform init -upgrade on every module\n' +
      '2. Adds provider hashes to the .terraform.lock.hcl for all major platforms',
    examples: [
      ['Initialize all Terraform modules', 'pf tf init'],
    ],
  });

  async execute(): Promise<number> {
    try {
      const success = initTerraformModules(this.context);
      return success === true ? 0 : 1;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? `Error initializing Terraform modules: ${error.message}`
        : 'Error initializing Terraform modules';
      this.context.stderr.write(errorMessage);
      return 1;
    }
  }
} 