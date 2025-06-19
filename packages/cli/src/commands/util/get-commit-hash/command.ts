import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getCommitHash } from '@/util/git/getCommitHash';

export class GetCommitHashCommand extends PanfactumCommand {
  static override paths = [['util', 'get-commit-hash']];

  static override usage = Command.Usage({
    description: 'Resolve git references to commit SHAs',
    category: 'Utility',
  });

  repo = Option.String('-r,--repo', 'origin', {
    description: 'Git repository (defaults to origin/current repo)',
  });

  ref = Option.String('-c,--ref', {
    description: 'Git reference to resolve (commit, branch, tag, or "local")',
  });

  noVerify = Option.Boolean('-n,--no-verify', false, {
    description: 'Skip verification that commit exists',
  });

  async execute() {
    const hash = await getCommitHash({
      repo: this.repo,
      ref: this.ref,
      noVerify: this.noVerify,
      context: this.context,
      workingDirectory: process.cwd(),
    });
    this.context.stdout.write(hash);
  }
}