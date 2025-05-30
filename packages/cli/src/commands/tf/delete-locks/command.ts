import { hostname } from 'os';
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { Option } from 'clipanion';
import { getIdentity } from '@/util/aws/getIdentity';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getPanfactumConfig } from '@/util/config/getPanfactumConfig';
import { CLIError } from '@/util/error/error';

export default class DeleteLocksCommand extends PanfactumCommand {
  static override paths = [['tf', 'delete-locks']];

  static override usage = PanfactumCommand.Usage({
    description: 'Release all Terraform/OpenTofu state locks held by a specific user',
    details: `
      This command releases all Terraform/OpenTofu state locks in the indicated DynamoDB lock table 
      that are held by the indicated user. This is useful when locks are stuck due to interrupted 
      terraform operations.
    `,
    examples: [
      ['Release all your locks using defaults', '$0 terraform delete-locks'],
      ['Release locks for specific user', '$0 terraform delete-locks --who "john@workstation"'],
      ['Use specific AWS profile and table', '$0 terraform delete-locks --profile prod --table my-locks'],
    ],
  });

  profile = Option.String('--profile', {
    description: 'AWS profile to use (defaults to tf_state_profile from config)',
  });

  table = Option.String('--table', {
    description: 'DynamoDB lock table name (defaults to tf_state_lock_table from config)',
  });

  region = Option.String('--region', {
    description: 'AWS region where lock table is located (defaults to tf_state_region from config)',
  });

  who = Option.String('--who', {
    description: 'Owner of locks to release (defaults to $(whoami)@$(hostname))',
  });

  override async execute(): Promise<number> {
    try {
      // Get config from current directory context
      const config = await getPanfactumConfig({ 
        context: this.context, 
        directory: process.cwd() 
      });

      // Determine values from options or config
      const awsProfile = this.profile || config.tf_state_profile;
      const lockTable = this.table || config.tf_state_lock_table;
      const awsRegion = this.region || config.tf_state_region;
      const lockOwner = this.who || `${process.env['USER'] || 'unknown'}@${hostname()}`;

      // Validate required values
      if (!awsProfile) {
        throw new CLIError(
          'Unable to derive AWS profile from current context. Retry with --profile.'
        );
      }
      if (!lockTable) {
        throw new CLIError(
          'Unable to derive lock table from current context. Retry with --table.'
        );
      }
      if (!awsRegion) {
        throw new CLIError(
          'Unable to derive AWS region from current context. Retry with --region.'
        );
      }

      // Verify AWS credentials
      await getIdentity({ context: this.context, profile: awsProfile });

      this.context.logger.info(
        `Releasing locks held by ${lockOwner} from ${lockTable} in ${awsRegion} using the ${awsProfile} AWS profile...`
      );

      // Initialize DynamoDB client with AWS profile
      // The AWS SDK will automatically use the credentials from the profile
      process.env['AWS_PROFILE'] = awsProfile;
      const dynamoClient = new DynamoDBClient({ 
        region: awsRegion
      });

      // Scan for locks held by the specified user
      const scanCommand = new ScanCommand({
        TableName: lockTable,
        ScanFilter: {
          Info: {
            ComparisonOperator: 'NOT_NULL'
          }
        }
      });

      const scanResult = await dynamoClient.send(scanCommand);
      
      if (!scanResult.Items || scanResult.Items.length === 0) {
        this.context.logger.info('No locks found in the table.');
        return 0;
      }

      // Filter locks by owner
      const locksToDelete = scanResult.Items.filter(item => {
        if (item['Info']?.S) {
          try {
            const info = JSON.parse(item['Info'].S) as { Who?: string };
            return info.Who === lockOwner;
          } catch {
            return false;
          }
        }
        return false;
      });

      if (locksToDelete.length === 0) {
        this.context.logger.info(`No locks found for user: ${lockOwner}`);
        return 0;
      }

      // Delete each lock
      for (const lock of locksToDelete) {
        if (lock['LockID']?.S) {
          this.context.logger.info(`Deleting lock with ID: ${lock['LockID'].S}`);
          
          const deleteCommand = new DeleteItemCommand({
            TableName: lockTable,
            Key: {
              LockID: { S: lock['LockID'].S }
            }
          });

          await dynamoClient.send(deleteCommand);
        }
      }

      this.context.logger.info(`Successfully released ${locksToDelete.length} lock(s).`);
      return 0;

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to delete locks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}