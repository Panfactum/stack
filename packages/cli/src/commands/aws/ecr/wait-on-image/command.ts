import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { checkImageExists } from '@/util/aws/checkImageExists';
import { AWS_ACCOUNT_ID_SCHEMA, AWS_REGION_SCHEMA } from '@/util/aws/schemas';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { CLIError } from '@/util/error/error';

export class AwsEcrWaitOnImageCommand extends PanfactumCommand {
  static override paths = [['aws', 'ecr', 'wait-on-image']];

  static override usage = Command.Usage({
    description: 'Wait for a container image to be available in AWS ECR',
    details: `Waits for a container image to be available in an AWS ECR repository before proceeding.
This is designed as a Terragrunt pre-hook to ensure container images are built and pushed before infrastructure deployment.`,
    examples: [
      ['Wait for image', 'pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest'],
      ['Wait with custom timeout', 'pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:v1.0 --timeout 600']
    ]
  });

  image = Option.String({ required: true });
  timeout = Option.String('--timeout', '300', {
    description: 'Timeout in seconds (default: 300)',
  });

  async execute() {
    // Parse the image specifier
    const imageParts = this.image.split(':');
    if (imageParts.length !== 2) {
      throw new CLIError('Image must include a tag (format: registry/repository:tag)');
    }
    const registryAndRepo = imageParts[0];
    const tag = imageParts[1];
    
    if (!registryAndRepo || !tag) {
      throw new CLIError('Image must include both registry/repository and tag');
    }

    const repoParts = registryAndRepo.split('/');
    if (repoParts.length !== 2) {
      throw new CLIError('Invalid image format. Expected: registry/repository:tag');
    }
    const registry = repoParts[0];
    const repoName = repoParts[1];
    
    if (!registry || !repoName) {
      throw new CLIError('Invalid image format. Registry and repository name are required');
    }

    const registryParts = registry.split('.');
    const accountId = registryParts[0];
    const region = registryParts[3];

    if (!accountId) {
      throw new CLIError('Invalid registry format: missing account ID');
    }

    if (!region) {
      throw new CLIError('Invalid registry format: missing region');
    }

    const accountIdValidation = AWS_ACCOUNT_ID_SCHEMA.safeParse(accountId);
    if (!accountIdValidation.success) {
      throw new CLIError(`Invalid AWS Account ID: ${accountIdValidation.error.errors[0]?.message || 'Invalid format'}`);
    }

    const regionValidation = AWS_REGION_SCHEMA.safeParse(region);
    if (!regionValidation.success) {
      throw new CLIError(`Invalid AWS region: ${regionValidation.error.errors[0]?.message || 'Invalid format'}`);
    }

    const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number);
    const timeoutSeconds = timeoutSchema.parse(this.timeout);
    const intervalSeconds = 30;
    let elapsed = 0;

    this.context.logger.info(`Waiting up to ${timeoutSeconds} seconds for image ${this.image} to be found.`);

    while (elapsed < timeoutSeconds) {
      const imageExists = await checkImageExists(accountId, repoName, tag, region, this.context);
      
      if (imageExists) {
        this.context.logger.success(`Found ${this.image}.`);
        return;
      }

      if (elapsed + intervalSeconds < timeoutSeconds) {
        this.context.logger.write('Still waiting...');
        await new Promise(resolve => globalThis.setTimeout(resolve, intervalSeconds * 1000));
      }
      
      elapsed += intervalSeconds;
    }

    throw new CLIError(`Could not find ${this.image} within ${timeoutSeconds} seconds.`);
  }
}