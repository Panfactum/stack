import { join, dirname } from "node:path"
import { Glob } from "bun";
import { z } from "zod";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig";
import { isEnvironmentDeployed } from "@/util/config/isEnvironmentDeployed";
import { CLIError } from "@/util/error/error";
import { MODULES } from "@/util/terragrunt/constants";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import type { DomainConfigs } from "./types";
import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask } from "listr2";

const REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA = z.object({
    zones: z.object({
        value: z.record(z.string(), z.object({
            zone_id: z.string()
        }))
    }),
    record_manager_role_arn: z.object({
        value: z.string()
    })
})

/**
 * Interface for getRegisteredDomainsTask function input
 */
interface IGetRegisteredDomainsTaskInput {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
}

/**
 * Interface for getRegisteredDomainsTask function output
 */
interface IGetRegisteredDomainsTaskOutput<T extends {}> {
  /** Listr task for registered domain retrieval */
  task: ListrTask<T>;
  /** Domain configurations retrieved from registered domains */
  domainConfigs: DomainConfigs;
}

export async function getRegisteredDomainsTask<T extends {}>(inputs: IGetRegisteredDomainsTaskInput): Promise<IGetRegisteredDomainsTaskOutput<T>> {
    const { context } = inputs;
    const domainConfigs: DomainConfigs = {}
    const { environments_dir: environmentsDir } = inputs.context.repoVariables;

    return {
        domainConfigs,
        task: {
            title: "Get registered domains",
            task: async (_, parentTask) => {
                const subtasks = parentTask.newListr([], { concurrent: true })
                const glob = new Glob(join(environmentsDir, "*", "*", MODULES.AWS_REGISTERED_DOMAINS, "terragrunt.hcl"));
                const domainModuleHCLPaths = Array.from(glob.scanSync(environmentsDir));
                for (const hclPath of domainModuleHCLPaths) {
                    const moduleDirectory = dirname(hclPath);
                    const { environment_dir: envDir, region_dir: regionDir, environment } = await getPanfactumConfig({ context, directory: moduleDirectory })
                    if (!envDir) {
                        throw new CLIError("Module is not in a valid environment directory.")
                    } else if (!regionDir) {
                        throw new CLIError("Module is not in a valid region directory.")
                    } else if (!environment) {
                        throw new CLIError("Environment is unknown")
                    }
                    subtasks.add({
                        title: `Get ${environment} registered domains`,
                        task: async () => {
                            const deployed = await isEnvironmentDeployed({ context, environment })
                            const moduleOutput = await terragruntOutput({
                                context,
                                environment: envDir,
                                region: regionDir,
                                module: MODULES.AWS_REGISTERED_DOMAINS,
                                validationSchema: REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA,
                            });

                            Object.entries(moduleOutput.zones.value).forEach(([domain, { zone_id: zoneId }]) => {
                                domainConfigs[domain] = {
                                    domain,
                                    zoneId,
                                    recordManagerRoleARN: moduleOutput.record_manager_role_arn.value,
                                    env: {
                                        name: environment,
                                        path: envDir,
                                        deployed
                                    },
                                }
                            })
                        }
                    })
                }

                return subtasks;
            }
        }
    }
}