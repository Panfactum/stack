import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getModuleHash } from '@/util/terragrunt/getModuleHash';

export class GetModuleHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-module-hash']];

  static override usage = Command.Usage({
    description: 'Generate SHA1 hash of Terraform module contents',
    category: 'Utilities',
  });

  modulePath = Option.String({ required: false });

  async execute(): Promise<number> {
    const hash = await getModuleHash(this.modulePath || '');
    if (hash) {
      this.context.stdout.write(hash);
    }
    return 0;
  }
}