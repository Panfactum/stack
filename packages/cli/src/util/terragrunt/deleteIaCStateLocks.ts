// This file provides a reusable utility for releasing Terraform/OpenTofu
// state locks held in DynamoDB by a particular owner. It is shared by the
// `pf iac delete-locks` command and by the apply-abort cleanup path in
// terragruntApply.

import { hostname, userInfo } from "node:os";
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { z } from "zod";
import { getDynamoDBClient } from "@/util/aws/clients/getDynamoDBClient";
import { getIdentity } from "@/util/aws/getIdentity";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { parseJson } from "@/util/json/parseJson";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Schema for the JSON metadata Terraform stores in the DynamoDB `Info`
 * field of a state lock entry.
 *
 * @remarks
 * All fields are optional because the format has shifted slightly across
 * Terraform/OpenTofu versions and we only depend on `Who` for filtering.
 */
const lockInfoSchema = z
  .object({
    /** Lock identifier (UUID) */
    ID: z.string().optional(),
    /** Terraform operation type (e.g. "OperationTypeApply") */
    Operation: z.string().optional(),
    /** Free-form lock info */
    Info: z.string().optional(),
    /** Owner of the lock, formatted as `username@hostname` */
    Who: z.string().optional(),
    /** Terraform/OpenTofu version that acquired the lock */
    Version: z.string().optional(),
    /** Lock creation timestamp */
    Created: z.string().optional(),
    /** Module path that the lock belongs to */
    Path: z.string().optional(),
  })
  .describe("Terraform state lock metadata");

/**
 * Input parameters for {@link deleteIaCStateLocks}
 */
interface IDeleteIaCStateLocksInput {
  /** Panfactum context for logging and AWS client construction */
  context: PanfactumContext;
  /**
   * Directory used to derive the AWS profile / lock table / region from
   * the hierarchical Panfactum configuration. Typically the working
   * directory of the module whose lock you are releasing.
   */
  directory: string;
  /**
   * Lock owner to filter by. Defaults to `${username}@${hostname}` of the
   * current process — which matches the `Who` field Terraform writes when
   * the lock is acquired from this machine.
   */
  who?: string;
  /** Override AWS profile (defaults to `tf_state_profile` from config) */
  profile?: string;
  /** Override DynamoDB lock table (defaults to `tf_state_lock_table` from config) */
  table?: string;
  /** Override AWS region (defaults to `tf_state_region` from config) */
  region?: string;
}

/**
 * Output of {@link deleteIaCStateLocks}
 */
interface IDeleteIaCStateLocksOutput {
  /** Number of lock entries that were deleted from the lock table */
  deletedCount: number;
  /** Lock owner that was filtered for */
  who: string;
  /** DynamoDB lock table that was scanned */
  table: string;
  /** AWS region of the lock table */
  region: string;
  /** AWS profile used to access the lock table */
  profile: string;
}

/**
 * Releases all Terraform/OpenTofu state locks held in DynamoDB by a
 * particular owner.
 *
 * @remarks
 * This is the shared implementation behind both the `pf iac delete-locks`
 * command and the apply-abort cleanup path in
 * {@link terragruntApply}. It:
 *
 *   1. Loads the hierarchical Panfactum config from `directory` to derive
 *      the AWS profile, lock table, and region — caller-supplied
 *      overrides take precedence.
 *   2. Verifies AWS credentials by calling `getIdentity`.
 *   3. Scans the DynamoDB lock table for entries with a non-null `Info`
 *      field.
 *   4. Filters down to entries whose `Who` field matches the requested
 *      owner (defaulting to `${username}@${hostname}` of the current
 *      process — which is what Terraform records when it acquires a lock
 *      on this machine).
 *   5. Deletes the matching entries in parallel.
 *
 * It only deletes locks owned by the specified `who`, so it is safe to
 * call from a CLI shutdown hook even when other applies may be running
 * elsewhere — those would have a different `Who` and be left alone.
 *
 * @param input - Configuration for the lock deletion. See {@link IDeleteIaCStateLocksInput}.
 * @returns Summary of the deletion. See {@link IDeleteIaCStateLocksOutput}.
 *
 * @throws {@link CLIError}
 * Throws when the AWS profile, lock table, or region cannot be determined
 * from the supplied directory's Panfactum configuration and no override
 * was provided.
 *
 * @example
 * ```typescript
 * const { deletedCount } = await deleteIaCStateLocks({
 *   context,
 *   directory: "/path/to/environments/prod/us-east-1/kube_ingress_nginx",
 * });
 * ```
 */
export async function deleteIaCStateLocks(
  input: IDeleteIaCStateLocksInput
): Promise<IDeleteIaCStateLocksOutput> {
  const { context, directory } = input;

  const config = await getPanfactumConfig({ context, directory });

  const awsProfile = input.profile ?? config.tf_state_profile;
  const lockTable = input.table ?? config.tf_state_lock_table;
  const awsRegion = input.region ?? config.tf_state_region;
  const lockOwner = input.who ?? `${userInfo().username}@${hostname()}`;

  if (!awsProfile) {
    throw new CLIError(
      "Unable to derive AWS profile from current context. Provide an explicit profile override."
    );
  }
  if (!lockTable) {
    throw new CLIError(
      "Unable to derive lock table from current context. Provide an explicit table override."
    );
  }
  if (!awsRegion) {
    throw new CLIError(
      "Unable to derive AWS region from current context. Provide an explicit region override."
    );
  }

  // Verify AWS credentials before issuing DynamoDB calls so we fail with
  // a clear credentials error rather than a confusing AccessDenied later.
  await getIdentity({ context, profile: awsProfile });

  context.logger.info(
    `Releasing locks held by ${lockOwner} from ${lockTable} in ${awsRegion} using the ${awsProfile} AWS profile...`,
    { highlights: [lockOwner, lockTable, awsRegion, awsProfile] }
  );

  const dynamoClient = await getDynamoDBClient({
    context,
    profile: awsProfile,
    region: awsRegion,
  });

  const scanResult = await dynamoClient.send(
    new ScanCommand({
      TableName: lockTable,
      ScanFilter: {
        Info: {
          ComparisonOperator: "NOT_NULL",
        },
      },
    })
  );

  if (!scanResult.Items || scanResult.Items.length === 0) {
    context.logger.info("No locks found in the table.");
    return {
      deletedCount: 0,
      who: lockOwner,
      table: lockTable,
      region: awsRegion,
      profile: awsProfile,
    };
  }

  const locksToDelete = scanResult.Items.filter((item) => {
    const infoValue = item["Info"]?.S;
    if (!infoValue) {
      return false;
    }
    try {
      const info = parseJson(lockInfoSchema, infoValue);
      return info.Who === lockOwner;
    } catch {
      return false;
    }
  });

  if (locksToDelete.length === 0) {
    context.logger.info(`No locks found for user: ${lockOwner}`, {
      highlights: [lockOwner],
    });
    return {
      deletedCount: 0,
      who: lockOwner,
      table: lockTable,
      region: awsRegion,
      profile: awsProfile,
    };
  }

  const deletePromises = locksToDelete
    .filter((lock) => lock["LockID"]?.S)
    .map(async (lock) => {
      const lockId = lock["LockID"]?.S;
      if (!lockId) {
        return; // Filtered above; satisfies TypeScript.
      }

      context.logger.info(`Deleting lock with ID: ${lockId}`, {
        highlights: [lockId],
      });

      await dynamoClient.send(
        new DeleteItemCommand({
          TableName: lockTable,
          Key: {
            LockID: { S: lockId },
          },
        })
      );
    });

  await Promise.all(deletePromises);

  context.logger.info(
    `Successfully released ${locksToDelete.length} lock(s).`
  );

  return {
    deletedCount: locksToDelete.length,
    who: lockOwner,
    table: lockTable,
    region: awsRegion,
    profile: awsProfile,
  };
}
