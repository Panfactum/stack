import { Command, Option } from 'clipanion';
import { checkImageExists } from '@/util/aws/checkImageExists';
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
    const registryAndRepo = imageParts[0]!;
    const tag = imageParts[1]!;

    const repoParts = registryAndRepo.split('/');
    if (repoParts.length !== 2) {
      throw new CLIError('Invalid image format. Expected: registry/repository:tag');
    }
    const registry = repoParts[0]!;
    const repoName = repoParts[1]!;

    const registryParts = registry.split('.');
    const accountId = registryParts[0];
    const region = registryParts[3];

    if (!accountId || !region) {
      throw new CLIError('Invalid ECR registry format');
    }

    const timeoutSeconds = parseInt(this.timeout, 10);
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
        this.context.logger.info('Still waiting...');
        await new Promise(resolve => globalThis.setTimeout(resolve, intervalSeconds * 1000));
      }
      
      elapsed += intervalSeconds;
    }

    throw new CLIError(`Could not find ${this.image} within ${timeoutSeconds} seconds.`);
  }
}