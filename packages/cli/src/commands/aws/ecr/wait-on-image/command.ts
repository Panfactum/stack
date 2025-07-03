// This command waits for a container image to be available in AWS ECR
// It's designed to be used as a Terragrunt pre-hook

import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { checkImageExists } from '@/util/aws/checkImageExists';
import { AWS_ACCOUNT_ID_SCHEMA, AWS_REGION_SCHEMA } from '@/util/aws/schemas';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import {getAllRegions} from "@/util/config/getAllRegions.ts";
import { CLIError } from '@/util/error/error';
import { sleep } from '@/util/util/sleep';

/**
 * Command for waiting on container images in AWS ECR
 * 
 * @remarks
 * This command polls AWS ECR until a specified container image becomes
 * available or a timeout is reached. It's primarily designed as a
 * Terragrunt pre-hook to ensure container images are built and pushed
 * before infrastructure deployment.
 * 
 * Key features:
 * - Polls ECR repository for image availability
 * - Configurable timeout (default 300 seconds)
 * - Validates ECR registry format and AWS credentials
 * - Provides progress updates during wait
 * 
 * Use cases:
 * - CI/CD pipelines with image dependencies
 * - Terragrunt pre-hooks for container deployments
 * - Ensuring images exist before ECS/EKS deployments
 * - Coordinating multi-stage build processes
 * 
 * The command expects images in ECR format:
 * `{account-id}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag}`
 * 
 * @example
 * ```bash
 * # Wait for image with default timeout
 * pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest
 * 
 * # Wait with custom timeout (10 minutes)
 * pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:v1.0 --timeout 600
 * 
 * # Use in Terragrunt hook
 * before_hook "wait_for_image" {
 *   commands = ["pf aws ecr wait-on-image ${var.image_uri}"]
 * }
 * ```
 * 
 * @see {@link checkImageExists} - Utility for checking ECR image existence
 */
export class AwsEcrWaitOnImageCommand extends PanfactumCommand {
  static override paths = [['aws', 'ecr', 'wait-on-image']];

  static override usage = Command.Usage({
    description: 'Wait for a container image to be available in AWS ECR',
    category: 'AWS',
    details: `Waits for a container image to be available in an AWS ECR repository before proceeding.
This is designed as a Terragrunt pre-hook to ensure container images are built and pushed before infrastructure deployment.`,
    examples: [
      ['Wait for image', 'pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest'],
      ['Wait with custom timeout', 'pf aws ecr wait-on-image 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:v1.0 --timeout 600']
    ]
  });

  /**
   * ECR image URI to wait for
   * 
   * @remarks
   * Must be in format: {account-id}.dkr.ecr.{region}.amazonaws.com/{repository}:{tag}
   */
  image = Option.String({ required: true });
  
  /**
   * Maximum time to wait for image in seconds
   * 
   * @remarks
   * Defaults to 300 seconds (5 minutes). The command polls every 30 seconds.
   */
  timeout = Option.String('--timeout', '300', {
    description: 'Timeout in seconds (default: 300)',
  });

  /**
   * Executes the wait-on-image command
   * 
   * @remarks
   * Parses the ECR image URI, validates its components, and polls ECR
   * until the image is found or timeout is reached. The polling interval
   * is fixed at 30 seconds.
   * 
   * @throws {@link CLIError}
   * Throws when image format is invalid or image is not found within timeout
   */
  async execute(): Promise<void> {
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

    const regions = await getAllRegions(this.context)

    const selectedRegion = regions.find(r => r.awsRegion === region);

    if (!selectedRegion || !selectedRegion.awsProfile) {
      throw new CLIError(`Invalid AWS region: ${region}.`);
    }

    if (!accountId) {
      throw new CLIError('Invalid registry format: missing account ID');
    }

    if (!region) {
      throw new CLIError('Invalid registry format: missing region');
    }

    const accountIdValidation = AWS_ACCOUNT_ID_SCHEMA.safeParse(accountId);
    if (!accountIdValidation.success) {
      throw new CLIError(`Invalid AWS Account ID: ${accountIdValidation.error.errors[0]?.message || 'Invalid format'} in the provided image name ${this.image}`);
    }

    const regionValidation = AWS_REGION_SCHEMA.safeParse(region);
    if (!regionValidation.success) {
      throw new CLIError(`Invalid AWS region: ${regionValidation.error.errors[0]?.message || 'Invalid format'} in the provided image name ${this.image}`);
    }

    const timeoutSchema = z.string().regex(/^\d+$/, 'Timeout must be a positive integer').transform(Number);
    const timeoutResult = timeoutSchema.safeParse(this.timeout);
    if (!timeoutResult.success) {
      throw new CLIError(`Invalid timeout value: ${timeoutResult.error.errors[0]?.message || 'must be a positive integer'}`);
    }
    const timeoutSeconds = timeoutResult.data;
    const intervalSeconds = 30;
    let elapsed = 0;

    this.context.logger.info(`Waiting up to ${timeoutSeconds} seconds for image ${this.image} to be found.`);

    while (elapsed < timeoutSeconds) {
      const imageExists = await checkImageExists({
        accountId,
        repoName,
        tag,
        region,
        profile: selectedRegion.awsProfile,
        context: this.context
      });
      
      if (imageExists) {
        this.context.logger.success(`Found ${this.image}.`);
        return;
      }

      if (elapsed + intervalSeconds < timeoutSeconds) {
        this.context.logger.write('Still waiting...');
        await sleep(intervalSeconds * 1000);
      }
      
      elapsed += intervalSeconds;
    }

    throw new CLIError(`Could not find ${this.image} within ${timeoutSeconds} seconds.`);
  }
}