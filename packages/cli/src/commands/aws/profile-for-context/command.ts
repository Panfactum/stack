import { Option } from 'clipanion';
import { getAWSProfileForContext } from "@/util/aws/getProfileForContext.ts";
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';

export default class ProfileForContextCommand extends PanfactumCommand {
  static override paths = [['aws', 'profile-for-context']];

  static override usage = PanfactumCommand.Usage({
    description: 'Get the AWS profile associated with a Kubernetes context',
    details: `
      This command returns the AWS profile that should be used when operating with
      a specific Kubernetes context.
    `,
    examples: [
      ['Get AWS profile for a context', '$0 aws profile-for-context production-primary'],
    ],
  });

  kubeContext = Option.String({ required: true });

  override async execute(): Promise<number> {
    const { kubeContext } = this;

    try {
      const awsProfile = await getAWSProfileForContext(this.context, kubeContext);

      // Output the profile
      this.context.stdout.write(awsProfile);

      return 0;
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to get AWS profile for context`, error
      );
    }
  }
}