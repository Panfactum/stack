import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';

export default class ProfileForContextCommand extends PanfactumCommand {
  static override paths = [['aws', 'profile-for-context']];

  static override usage = PanfactumCommand.Usage({
    description: 'Get the AWS profile associated with a Kubernetes context',
    details: `
      This command returns the AWS profile that should be used when operating with
      a specific Kubernetes context. The mapping is defined in your kube/config.user.yaml file.
    `,
    examples: [
      ['Get AWS profile for a context', '$0 aws profile-for-context production-primary'],
    ],
  });

  kubeContext = Option.String({ required: true });

  override async execute(): Promise<number> {
    const { kubeContext } = this;

    try {
      // Get repository variables
      const { repoVariables } = this.context;
      const kubeDir = repoVariables.kube_dir;
      const kubeUserConfigFile = join(kubeDir, 'config.user.yaml');

      // Check if config file exists
      if (!existsSync(kubeUserConfigFile)) {
        throw new CLIError(
          `Error: ${kubeUserConfigFile} does not exist. It is required to set this up before interacting with BuildKit.`
        );
      }

      // Check if context exists in kubeconfig
      try {
        execSync(`kubectl config get-contexts "${kubeContext}"`, {
          stdio: 'pipe',
          encoding: 'utf8',
        });
      } catch {
        throw new CLIError(
          `'${kubeContext}' not found in kubeconfig. Run pf-update-kube to regenerate kubeconfig.`
        );
      }

      // Get AWS profile from config
      const awsProfile = execSync(
        `yq -r '.clusters[] | select(.name == "${kubeContext}") | .aws_profile' "${kubeUserConfigFile}"`,
        { encoding: 'utf8', stdio: 'pipe' }
      ).trim();

      if (!awsProfile || awsProfile === 'null') {
        throw new CLIError(
          `Error: AWS profile not configured for cluster ${kubeContext}. Add cluster to ${kubeUserConfigFile}.`
        );
      }

      // Output the profile
      this.context.stdout.write(awsProfile);
      this.context.stdout.write('\n');

      return 0;
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to get AWS profile for context: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}