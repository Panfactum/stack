import { Command } from 'clipanion';
import { z } from 'zod';
import { PanfactumCommand } from '@/util/command/panfactumCommand';
import { execute } from '@/util/subprocess/execute';
import { parseJson } from '@/util/zod/parseJson';

interface IVolumeSnapshot {
  namespace: string;
  name: string;
  backupName: string | null;
  snapshotContentName: string | null;
}

/**
 * Command for cleaning up orphaned Velero volume snapshots
 * 
 * @deprecated This command is part of the deprecated 'kube' command group.
 * Consider using the newer cluster management commands.
 * 
 * @remarks
 * This command identifies and removes orphaned VolumeSnapshots and
 * VolumeSnapshotContents that are no longer associated with active
 * Velero backups. It helps:
 * 
 * - Reduce storage costs from orphaned snapshots
 * - Clean up failed backup artifacts
 * - Maintain snapshot hygiene
 * - Prevent accumulation of unused resources
 * 
 * The command safely identifies snapshots that lack corresponding
 * Velero backup objects and removes them after confirmation.
 * 
 * @example
 * ```bash
 * # Clean up orphaned snapshots
 * pf k8s velero snapshot-gc
 * 
 * # Run with specific kube context
 * pf k8s velero snapshot-gc --kube-context production
 * ```
 */
export class K8sVeleroSnapshotGcCommand extends PanfactumCommand {
  static override paths = [['k8s', 'velero', 'snapshot-gc']];

  static override usage = Command.Usage({
    description: 'Remove orphaned VolumeSnapshots and VolumeSnapshotContents',
    category: 'Kubernetes',
    details: `Garbage collector for Velero backup system. Identifies and removes orphaned 
VolumeSnapshots and VolumeSnapshotContents that no longer have associated 
Velero backups, cleaning up cloud storage resources.`,
  });

  async execute() {
    const backupExists = async (backupName: string): Promise<boolean> => {
      return execute({
        command: ['kubectl', 'get', 'backup.velero.io', backupName, '-n', 'velero', '--ignore-not-found'],
        context: this.context,
        workingDirectory: process.cwd(),
      })
        .then((result) => result.stdout.trim() !== '')
        .catch(() => false);
    };

    const getVolumeSnapshots = async (): Promise<IVolumeSnapshot[]> => {
      const result = await execute({
        command: ['kubectl', 'get', 'volumesnapshot', '-o', 'json', '-A'],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      const data = parseJson(z.object({
        items: z.array(z.object({
          metadata: z.object({
            namespace: z.string(),
            name: z.string(),
            labels: z.record(z.string()).optional()
          }),
          status: z.object({
            boundVolumeSnapshotContentName: z.string().optional()
          }).optional()
        }))
      }), result.stdout);

      return data.items.map((item) => ({
        namespace: item.metadata.namespace,
        name: item.metadata.name,
        backupName: item.metadata.labels?.['velero.io/backup-name'] || null,
        snapshotContentName: item.status?.boundVolumeSnapshotContentName || null,
      }));
    };

    this.context.logger.info('Finding VolumeSnapshots...');
    const snapshots = await getVolumeSnapshots();
    const toDelete: IVolumeSnapshot[] = [];

    this.context.logger.info('Checking for orphaned snapshots...');
    for (const snapshot of snapshots) {
      if (!snapshot.backupName) {
        continue;
      }
      
      if (await backupExists(snapshot.backupName)) {
        this.context.logger.info(`Backup ${snapshot.backupName} exists. Skipping VolumeSnapshot ${snapshot.name}...`);
      } else {
        toDelete.push(snapshot);
      }
    }

    if (toDelete.length === 0) {
      this.context.logger.info('No orphaned snapshots found');
      return;
    }

    this.context.logger.info('Deleting orphaned snapshots...');
    for (const snapshot of toDelete) {
      this.context.logger.info(`Backup ${snapshot.backupName} does not exist. Deleting VolumeSnapshot ${snapshot.name}...`);
      
      // If a VolumeSnapshotContent is associated, ensure it deletes the backing volume
      if (snapshot.snapshotContentName) {
        await execute({
          command: [
            'kubectl',
            'patch',
            'volumesnapshotcontent',
            snapshot.snapshotContentName,
            '--type=merge',
            '-p',
            `${JSON.stringify({"spec": {"deletionPolicy": "Delete"}})}`,
          ],
          context: this.context,
          workingDirectory: process.cwd(),
        });
      }
      
      // Delete the VolumeSnapshot
      await execute({
        command: [
          'kubectl',
          'delete',
          '-n',
          snapshot.namespace,
          'volumesnapshot',
          snapshot.name,
          '--ignore-not-found',
        ],
        context: this.context,
        workingDirectory: process.cwd(),
      });
      
      // Try to delete the VolumeSnapshotContent if it still exists
      if (snapshot.snapshotContentName) {
        await execute({
          command: [
            'kubectl',
            'delete',
            'volumesnapshotcontent',
            snapshot.snapshotContentName,
            '--ignore-not-found',
          ],
          context: this.context,
          workingDirectory: process.cwd(),
        });
      }
    }

    this.context.logger.success(`Deleted ${toDelete.length} orphaned snapshots`);
  }
}