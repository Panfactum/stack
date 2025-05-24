import { Command } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { execute } from '@/util/subprocess/execute';

export class TerraformInitCommand extends PanfactumCommand {
  static override paths = [['terraform', 'init']];

  static override usage = Command.Usage({
    description: 'Initialize Terraform/OpenTofu modules and lock providers for cross-platform compatibility',
    details: 'Runs terragrunt init -upgrade on all modules and locks providers for multiple platforms to ensure cross-platform compatibility',
  });

  async execute() {
    // Run terragrunt init -upgrade on all modules
    this.context.logger.info('Running terragrunt init -upgrade on all modules...');
    await execute({
      command: ['terragrunt', 'run-all', 'init', '-upgrade', '--terragrunt-ignore-external-dependencies'],
      context: this.context,
      workingDirectory: process.cwd(),
      errorMessage: 'Failed to run terragrunt init'
    });

    // Lock providers for all platforms
    this.context.logger.info('Locking providers for all platforms...');
    await execute({
      command: [
        'terragrunt',
        'run-all',
        'providers',
        'lock',
        '-platform=linux_amd64',
        '-platform=linux_arm64',
        '-platform=darwin_amd64',
        '-platform=darwin_arm64',
        '--terragrunt-ignore-external-dependencies'
      ],
      context: this.context,
      workingDirectory: process.cwd(),
      errorMessage: 'Failed to lock providers'
    });

    this.context.logger.success('Terraform modules initialized successfully');
  }
}