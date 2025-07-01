// This command disables voluntary disruptions for pods after maintenance windows
// It's part of the deprecated kube command group

import { Command, Option } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { PanfactumZodError } from '@/util/error/error';
import { getPDBAnnotations } from '@/util/kube/getPDBAnnotations';
import { getPDBsByWindowId } from '@/util/kube/getPDBs';
import { PDB_ANNOTATIONS } from '@/util/kube/pdbConstants';
import { execute } from '@/util/subprocess/execute';

/**
 * Schema for validating Unix timestamp strings
 * 
 * @remarks
 * Validates that a string contains only digits and represents
 * a positive Unix timestamp. Transforms the string to a number.
 * 
 * @example
 * ```typescript
 * const valid = timestampSchema.parse('1640995200'); // Returns 1640995200
 * const invalid = timestampSchema.parse('-123'); // Throws error
 * ```
 */
const timestampSchema = z.string()
  .regex(/^\d+$/, 'Timestamp must be a numeric string')
  .transform(Number)
  .refine((timestamp) => timestamp > 0, {
    message: 'Timestamp must be a positive number'
  })
  .describe('Unix timestamp validation');

/**
 * Command for disabling pod disruptions after maintenance windows
 * 
 * @deprecated This command is part of the deprecated 'kube' command group.
 * Consider using the newer disruption management features.
 * 
 * @remarks
 * This command manages Pod Disruption Budgets (PDBs) to prevent
 * voluntary evictions after maintenance windows have expired. It:
 * 
 * - Finds PDBs with specific window ID annotations
 * - Checks if maintenance windows have expired
 * - Sets maxUnavailable=0 to prevent disruptions
 * - Removes window start annotations
 * 
 * Key features:
 * - Window-based disruption management
 * - Automatic expiration detection
 * - Batch processing of multiple PDBs
 * - Safe handling of missing annotations
 * 
 * Maintenance windows are defined by:
 * - Window ID: Groups related PDBs
 * - Start time: Unix timestamp when window began
 * - Duration: Window length in seconds (default 3600)
 * 
 * This prevents pods from being evicted for:
 * - Node maintenance
 * - Cluster autoscaling
 * - Manual disruptions
 * 
 * Use cases:
 * - Post-maintenance lockdown
 * - Preventing cascading failures
 * - Ensuring service stability
 * 
 * @example
 * ```bash
 * # Disable disruptions for expired windows
 * pf kube disable-disruptions --namespace prod --window-id maint-2024
 * 
 * # Short form
 * pf kube disable-disruptions -n staging -w deploy-123
 * ```
 * 
 * @see {@link getPDBsByWindowId} - For finding relevant PDBs
 * @see {@link getPDBAnnotations} - For reading PDB metadata
 */
export class K8sDisruptionsDisableCommand extends PanfactumCommand {
  static override paths = [['kube', 'disable-disruptions']];

  static override usage = Command.Usage({
    description: 'Disable voluntary disruptions for expired maintenance windows',
    category: 'Kubernetes',
    details: `
[DEPRECATED] This command is part of the deprecated 'kube' command group.

Disables voluntary disruptions for Kubernetes Pod Disruption Budgets (PDBs)
after a maintenance window has expired. Sets maxUnavailable=0 on PDBs that
have passed their disruption window time, preventing pods from being evicted.

Maintenance windows are tracked via PDB annotations and automatically
expire based on configured duration.
    `,
    examples: [
      ['Disable disruptions', 'pf kube disable-disruptions --namespace production --window-id maintenance-2024'],
      ['Short form', 'pf kube disable-disruptions -n prod -w maint-123']
    ]
  });

  /**
   * Kubernetes namespace containing the PDBs
   * 
   * @remarks
   * Must be a valid namespace where the target PDBs exist.
   */
  namespace = Option.String('-n,--namespace', { required: true });
  
  /**
   * Window identifier for grouping PDBs
   * 
   * @remarks
   * Used to find all PDBs that belong to the same maintenance window.
   * Must match the value used when enabling disruptions.
   */
  windowId = Option.String('-w,--window-id', { required: true });

  /**
   * Executes the disruption disabling process
   * 
   * @remarks
   * This method:
   * 1. Finds all PDBs with the specified window ID
   * 2. Checks each PDB's window start time and duration
   * 3. Disables disruptions for expired windows
   * 4. Skips PDBs without proper annotations or active windows
   * 
   * The process is idempotent - running multiple times is safe.
   * Each PDB is processed independently to prevent cascading failures.
   * 
   * @throws {@link PanfactumZodError}
   * Throws when timestamp annotations have invalid format
   */
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
        const lengthResult = timestampSchema.safeParse(lengthSecondsAnnotation);
        if (!lengthResult.success) {
          throw new PanfactumZodError('Invalid timestamp format for window length', 'window-seconds', lengthResult.error);
        }
        lengthSeconds = lengthResult.data;
      } else {
        this.context.logger.warn(`\tWarning: PDB does not have '${PDB_ANNOTATIONS.WINDOW_SECONDS}' annotation. Defaulting disruption window length to 3600 seconds.`);
      }
      
      if (!startTime) {
        this.context.logger.info(`\tSkipping... PDB does not have '${PDB_ANNOTATIONS.WINDOW_START}' annotation.`);
        skipped++;
      } else {
        const startResult = timestampSchema.safeParse(startTime);
        if (!startResult.success) {
          throw new PanfactumZodError('Invalid timestamp format for window start', 'window-start', startResult.error);
        }
        const startTimestamp = startResult.data;
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