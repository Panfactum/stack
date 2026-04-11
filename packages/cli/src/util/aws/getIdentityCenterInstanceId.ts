// This file provides a utility to retrieve the AWS IAM Identity Center instance ID
// for the current AWS account and region

import { ListInstancesCommand } from "@aws-sdk/client-sso-admin";
import { getSSOAdminClient } from "@/util/aws/clients/getSSOAdminClient";
import { CLIError } from "@/util/error/error";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Input parameters for retrieving the IAM Identity Center instance ID
 */
interface IGetIdentityCenterInstanceIdInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** AWS profile name to use for credentials */
  profile?: string;
  /** AWS region where IAM Identity Center is configured */
  region: string;
}

/**
 * Retrieves the IAM Identity Center instance ID for the current AWS account
 *
 * @remarks
 * AWS IAM Identity Center has exactly one instance per AWS organization. This
 * function calls `ListInstances` and returns the instance ID of the first result.
 *
 * @param input - Configuration including context, profile, and region
 * @returns The IAM Identity Center instance ID (e.g. `"79074eba885d66f0"`)
 *
 * @throws {@link CLIError}
 * Throws when no IAM Identity Center instance is found in the account/region,
 * which typically means the service has not been enabled yet.
 */
export async function getIdentityCenterInstanceId(input: IGetIdentityCenterInstanceIdInput): Promise<string> {
    const { context, profile, region } = input;

    const client = await getSSOAdminClient({ context, profile, region });
    const response = await client.send(new ListInstancesCommand({}));

    const instanceId = response.Instances?.[0]?.InstanceArn?.split("/").pop();

    if (!instanceId) {
        throw new CLIError([
            "No IAM Identity Center instance found.",
            "Please enable IAM Identity Center in the AWS console before continuing.",
        ]);
    }

    return instanceId;
}
