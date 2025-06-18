import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { getPDBAnnotations } from '@/util/kube/getPDBAnnotations';
import { getPDBsByWindowId } from '@/util/kube/getPDBs';
import { PDB_ANNOTATIONS } from '@/util/kube/pdbConstants';
import { execute } from '@/util/subprocess/execute';

// Zod schema for timestamp validation
const timestampSchema = z.string()
  .regex(/^\d+$/, 'Timestamp must be a numeric string')
  .transform(Number)
  .refine((timestamp) => timestamp > 0, {
    message: 'Timestamp must be a positive number'
  });

export class K8sDisruptionsDisableCommand extends PanfactumCommand {
  static override paths = [['kube', 'disable-disruptions']];

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

    const preventDisruptions = async (pdb: string): Promise<void> => {
      await execute({
        command: [
          'kubectl', 'patch', pdb,
          '-n', this.namespace,
          '--type=json',
          '-p=' + JSON.stringify([{
            op: 'replace',
            path: '/spec/maxUnavailable',
            value: 0
          }]),
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      await execute({
        command: [
          'kubectl', 'annotate', pdb,
          '-n', this.namespace,
          `${PDB_ANNOTATIONS.WINDOW_START}-`,
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

    let disabled = 0;
    let skipped = 0;

    this.context.logger.info('Processing PDBs...');
    for (const pdb of pdbs) {
      this.context.logger.info(`Disabling disruption window for '${pdb}' in namespace '${this.namespace}':`);
      
      const annotations = await getPDBAnnotations({
        context: this.context,
        namespace: this.namespace,
        pdbName: pdb
      });
      const startTime = annotations[PDB_ANNOTATIONS.WINDOW_START];
      let lengthSeconds = 3600;
      const lengthSecondsAnnotation = annotations[PDB_ANNOTATIONS.WINDOW_SECONDS];
      if (lengthSecondsAnnotation) {
        lengthSeconds = timestampSchema.parse(lengthSecondsAnnotation);
      } else {
        this.context.logger.warn(`\tWarning: PDB does not have '${PDB_ANNOTATIONS.WINDOW_SECONDS}' annotation. Defaulting disruption window length to 3600 seconds.`);
      }
      
      if (!startTime) {
        this.context.logger.info(`\tSkipping... PDB does not have '${PDB_ANNOTATIONS.WINDOW_START}' annotation.`);
        skipped++;
      } else {
        const startTimestamp = timestampSchema.parse(startTime);
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (startTimestamp + lengthSeconds >= currentTime) {
          this.context.logger.info(`\tSkipping.. PDB started disruption window less than ${lengthSeconds} seconds ago.`);
          skipped++;
        } else {
          this.context.logger.info(`\tUpdating '${pdb}' in namespace '${this.namespace}' with maxUnavailable=0`);
          await preventDisruptions(pdb);
          disabled++;
        }
      }
    }

    this.context.logger.success(`Processed ${pdbs.length} PDBs: ${disabled} disabled, ${skipped} skipped`);
  }
}