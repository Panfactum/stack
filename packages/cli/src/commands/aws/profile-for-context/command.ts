import { Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';
import { getAWSProfileForContext } from '@/util/aws/getProfileForContext';

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
      // Get AWS profile using the utility function
      const awsProfile = getAWSProfileForContext(this.context, kubeContext);

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