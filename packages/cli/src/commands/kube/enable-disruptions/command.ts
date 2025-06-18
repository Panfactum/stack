import { Command, Option } from 'clipanion';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getPDBAnnotations } from '@/util/kube/getPDBAnnotations';
import { getPDBsByWindowId } from '@/util/kube/getPDBs';
import { PDB_ANNOTATIONS } from '@/util/kube/pdbConstants';
import { execute } from '@/util/subprocess/execute';

export class K8sDisruptionsEnableCommand extends PanfactumCommand {
  static override paths = [['kube', 'enable-disruptions']];

  static override usage = Command.Usage({
    description: 'Enable voluntary disruptions for Pod Disruption Budgets',
    details: `Enables voluntary disruptions for Kubernetes PDBs during maintenance windows. 
Sets the appropriate maxUnavailable value (from annotations or defaulting to 1) 
and marks the start time of the disruption window.`,
    examples: [
      ['Enable disruptions', 'pf k8s disruptions enable --namespace production --window-id maintenance-2024'],
    ]
  });

  namespace = Option.String('-n,--namespace', { required: true });
  windowId = Option.String('-w,--window-id', { required: true });

  async execute() {

    const enableDisruptions = async (pdb: string, maxUnavailable: number): Promise<void> => {
      await execute({
        command: [
          'kubectl', 'patch', pdb,
          '-n', this.namespace,
          '--type=json',
          '-p=' + JSON.stringify([{
            op: 'replace',
            path: '/spec/maxUnavailable',
            value: maxUnavailable
          }]),
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      const currentTime = Math.floor(Date.now() / 1000);
      await execute({
        command: [
          'kubectl', 'annotate', pdb,
          '-n', this.namespace,
          `${PDB_ANNOTATIONS.WINDOW_START}=${currentTime}`,
          '--overwrite',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
    };

    this.context.logger.info('Finding PDBs with disruption windows...');
    const pdbs = await getPDBsByWindowId({
      context: this.context,
      namespace: this.namespace,
      windowId: this.windowId
    });
    
    if (pdbs.length === 0) {
      this.context.logger.info(`No PDBs found with window ID '${this.windowId}' in namespace '${this.namespace}'`);
      return;
    }

    let enabled = 0;

    this.context.logger.info('Processing PDBs...');
    for (const pdb of pdbs) {
      this.context.logger.info(`Enabling disruption window for '${pdb}' in namespace '${this.namespace}':`);
      
      const annotations = await getPDBAnnotations({
        context: this.context,
        namespace: this.namespace,
        pdbName: pdb
      });
      const maxUnavailableStr = annotations[PDB_ANNOTATIONS.MAX_UNAVAILABLE];
      let maxUnavailable: number;
      
      if (!maxUnavailableStr) {
        this.context.logger.warn(`\tWarning: PDB does not have '${PDB_ANNOTATIONS.MAX_UNAVAILABLE}' annotation. Defaulting to 1.`);
        maxUnavailable = 1;
      } else {
        maxUnavailable = parseInt(maxUnavailableStr, 10);
        if (maxUnavailable === 0) {
          this.context.logger.warn(`\tWarning: PDB has '${PDB_ANNOTATIONS.MAX_UNAVAILABLE}' annotation set to 0 which is not allowed. Defaulting to 1.`);
          maxUnavailable = 1;
        }
      }
      
      this.context.logger.info(`\tUpdating PDB with maxUnavailable=${maxUnavailable}`);
      await enableDisruptions(pdb, maxUnavailable);
      enabled++;
    }

    this.context.logger.success(`Enabled disruptions for ${enabled} PDBs`);
  }
}