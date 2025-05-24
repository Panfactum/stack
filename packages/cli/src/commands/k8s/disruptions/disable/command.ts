import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { execute } from '@/util/subprocess/execute';

export class K8sDisruptionsDisableCommand extends PanfactumCommand {
  static override paths = [['k8s', 'disruptions', 'disable']];

  static override usage = Command.Usage({
    description: 'Disable voluntary disruptions for Pod Disruption Budgets',
    details: `Disables voluntary disruptions for Kubernetes Pod Disruption Budgets (PDBs) 
after a maintenance window has expired. Sets maxUnavailable=0 on PDBs that 
have passed their disruption window time, preventing pods from being evicted.`,
    examples: [
      ['Disable disruptions', 'pf k8s disruptions disable --namespace production --window-id maintenance-2024'],
    ]
  });

  namespace = Option.String('-n,--namespace', { required: true });
  windowId = Option.String('-w,--window-id', { required: true });

  async execute() {
    const getPDBs = async (): Promise<string[]> => {
      const result = await execute({
        command: [
          'kubectl', 'get', 'pdb',
          '-n', this.namespace,
          '-l', `panfactum.com/voluntary-disruption-window-id=${this.windowId}`,
          '--ignore-not-found',
          '-o', 'name',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      return result.stdout
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
    };

    const getAnnotations = async (pdb: string): Promise<Record<string, string>> => {
      const result = await execute({
        command: [
          'kubectl', 'get', pdb,
          '-n', this.namespace,
          '-o', 'jsonpath={.metadata.annotations}',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      return JSON.parse(result.stdout || '{}');
    };

    const disablePDB = async (pdb: string): Promise<void> => {
      await execute({
        command: [
          'kubectl', 'patch', pdb,
          '-n', this.namespace,
          '--type=json',
          '-p=[{"op": "replace", "path": "/spec/maxUnavailable", "value": 0}]',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      await execute({
        command: [
          'kubectl', 'annotate', pdb,
          '-n', this.namespace,
          'panfactum.com/voluntary-disruption-window-start-',
          '--overwrite',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
    };

    this.context.logger.info('Finding PDBs with disruption windows...');
    const pdbs = await getPDBs();
    
    if (pdbs.length === 0) {
      this.context.logger.info(`No PDBs found with window ID '${this.windowId}' in namespace '${this.namespace}'`);
      return;
    }

    let disabled = 0;
    let skipped = 0;

    this.context.logger.info('Processing PDBs...');
    for (const pdb of pdbs) {
      this.context.logger.info(`Disabling disruption window for '${pdb}' in namespace '${this.namespace}':`);
      
      const annotations = await getAnnotations(pdb);
      const startTime = annotations['panfactum.com/voluntary-disruption-window-start'];
      const lengthSeconds = parseInt(annotations['panfactum.com/voluntary-disruption-window-seconds'] || '3600', 10);
      
      if (!startTime) {
        this.context.logger.info(`\tSkipping... PDB does not have 'panfactum.com/voluntary-disruption-window-start' annotation.`);
        skipped++;
      } else {
        const startTimestamp = parseInt(startTime, 10);
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (startTimestamp + lengthSeconds >= currentTime) {
          this.context.logger.info(`\tSkipping.. PDB started disruption window less than ${lengthSeconds} seconds ago.`);
          skipped++;
        } else {
          this.context.logger.info(`\tUpdating '${pdb}' in namespace '${this.namespace}' with maxUnavailable=0`);
          await disablePDB(pdb);
          disabled++;
        }
      }
    }

    this.context.logger.success(`Processed ${pdbs.length} PDBs: ${disabled} disabled, ${skipped} skipped`);
  }
}