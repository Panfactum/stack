// This command retrieves the AWS profile associated with a Kubernetes context
// It's part of the deprecated kube command group

import { Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';
import { getAWSProfileForContext } from "@/util/kube/getAWSProfileForContext.ts";

/**
 * Command for retrieving AWS profile associated with Kubernetes context
 * 
 * @deprecated This command is part of the deprecated 'kube' command group.
 * Consider using the newer cluster management commands.
 * 
 * @remarks
 * This command looks up the AWS profile that should be used when operating
 * with a specific Kubernetes context. It helps bridge the gap between
 * Kubernetes operations and AWS authentication by:
 * 
 * - Mapping kubectl contexts to AWS profiles
 * - Providing the correct profile for AWS SDK operations
 * - Enabling context-aware AWS authentication
 * 
 * @example
 * ```bash
 * # Get AWS profile for production context
 * pf kube profile-for-context production-primary
 * 
 * # Use in scripts
 * export AWS_PROFILE=$(pf kube profile-for-context dev-cluster)
 * ```
 */
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
      const awsProfile = await getAWSProfileForContext({ context: this.context, kubeContext });

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