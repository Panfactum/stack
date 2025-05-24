import { Command } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';

export class DevshellEnterCommand extends PanfactumCommand {
  static override paths = [['devshell', 'enter']];

  static override usage = Command.Usage({
    description: 'Output environment setup for the Panfactum development shell',
    details: `Outputs shell export commands to set up the local development environment.
This command is meant to be evaluated by the shell to set environment variables.

Usage: eval "$(pf devshell enter)"`,
    examples: [
      ['Enter devshell', 'eval "$(pf devshell enter)"']
    ]
  });

  async execute() {
    const { repoVariables } = this.context;
    const kubeDir = repoVariables.kube_dir;
    const awsDir = repoVariables.aws_dir;
    const repoRoot = repoVariables.repo_root;
    const buildkitDir = repoVariables.buildkit_dir;

    // Output the export commands that need to be evaluated
    const exports = [
      '# General Metadata',
      'export CI="false"',
      'export PF_DEVSHELL=1',
      '',
      '# Kubernetes',
      `export KUBECONFIG="${kubeDir}/config"`,
      `export KUBE_CONFIG_PATH=$KUBECONFIG`,
      '',
      '# AWS',
      `export AWS_SHARED_CREDENTIALS_FILE="${awsDir}/credentials"`,
      `export AWS_CONFIG_FILE="${awsDir}/config"`,
      'unset AWS_ACCESS_KEY_ID',
      'unset AWS_SECRET_ACCESS_KEY',
      '',
      '# IaC',
      `export TERRAGRUNT_DOWNLOAD="${repoRoot}/.terragrunt-cache"`,
      'export TERRAGRUNT_FETCH_DEPENDENCY_OUTPUT_FROM_STATE="true"',
      'export TERRAGRUNT_FORWARD_TF_STDOUT=1',
      `export TF_PLUGIN_CACHE_DIR="${repoRoot}/.terraform"`,
      '',
      '# Git LFS Fix',
      'export GIT_CLONE_PROTECTION_ACTIVE=false',
      '',
      '# Local BuildKit Configuration',
      `export REGISTRY_AUTH_FILE="${buildkitDir}/config.json"`,
      `export DOCKER_CONFIG=${buildkitDir}`,
      '',
      '# Create terraform cache directory if needed',
      `mkdir -p "${repoRoot}/.terraform"`
    ];

    // Output the export commands
    this.context.stdout.write(exports.join('\n') + '\n');
  }
}