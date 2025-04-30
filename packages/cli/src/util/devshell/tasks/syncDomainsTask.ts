import { join } from "node:path";
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { getZonesTask } from "@/util/domains/tasks/getZonesTask";


import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask } from "listr2";

export async function syncDomainsTask<T extends {}>(inputs: {
    context: PanfactumContext;
}): Promise<ListrTask<T>> {
    const { context } = inputs;

    return {
        title: "Sync domains",
        task: async (_, parentTask) => {

            const subtasks = parentTask.newListr<{}>([]);

            ///////////////////////////////////////////////////////
            // Get the zone information
            ///////////////////////////////////////////////////////
            const { task, domainConfigs } = await getZonesTask({
                context
            })
            subtasks.add(task)

            ///////////////////////////////////////////////////////
            // Write the configuration files
            ///////////////////////////////////////////////////////
            subtasks.add({
                title: `Writing zone info to DevShell config`,
                task: async () => {
                    const updates = Object.entries(domainConfigs).reduce((acc, [domain, config]) => {
                        return {
                            ...acc,
                            ...{
                                [config.env.path]: {
                                    ...acc[config.env.path],
                                    ...{
                                        [domain]: {
                                            zone_id: config.zoneId,
                                            record_manager_role_arn: config.recordManagerRoleARN
                                        }
                                    }
                                }
                            }
                        }
                    }, {} as { [path: string]: { [domain: string]: { zone_id: string, record_manager_role_arn: string } } })

                    await Promise.all(Object.entries(updates).map(([path, domains]) => {
                        return upsertConfigValues({
                            context,
                            filePath: join(context.repoVariables.environments_dir, path, "environment.yaml"),
                            values: {
                                domains
                            }
                        })
                    }))
                },
            });

            return subtasks
        },
    };
}
