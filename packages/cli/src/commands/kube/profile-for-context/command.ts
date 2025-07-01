import { Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';
import { getAWSProfileForContext } from "@/util/kube/getAWSProfileForContext.ts";

export default class ProfileForContextCommand extends PanfactumCommand {
  static override paths = [['kube', 'profile-for-context']];

  static override usage = PanfactumCommand.Usage({
    description: 'Get the AWS profile associated with a Kubernetes context',
    category: 'Kubernetes',
    details: `
      This command returns the AWS profile that should be used when operating with
      a specific Kubernetes context.
    `,
    examples: [
      ['Get AWS profile for a context', '$0 kube profile-for-context production-primary'],
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
      throw new CLIError(
        `Failed to get AWS profile for context`, error
      );
    }
  }
}