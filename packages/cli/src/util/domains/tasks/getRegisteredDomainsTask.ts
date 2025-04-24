import type { PanfactumContext } from "@/context/context";
import { MODULES } from "../../terragrunt/constants";
import { Glob } from "bun";
import {join, dirname} from "node:path"
import { terragruntOutput } from "../../terragrunt/terragruntOutput";
import { CLIError } from "../../error/error";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { z } from "zod";
import type { ListrTask } from "listr2";
import { applyColors } from "@/util/colors/applyColors";
import type { DomainConfigs } from "./types";

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


export async function getRegisteredDomainsTask<T extends {}>(inputs: {
    context: PanfactumContext
}): Promise<{task: ListrTask<T>, domainConfigs: DomainConfigs}>{
    const {context} = inputs;
    const domainConfigs: DomainConfigs = {}
    const {environments_dir: environmentsDir} = inputs.context.repoVariables;

    return {
        domainConfigs,
        task: {
            title: "Get registered domains from all environments",
            task: async (_, parentTask) => {
                const subtasks = parentTask.newListr([])
                const glob = new Glob(join(environmentsDir, "*", "*", MODULES.AWS_REGISTERED_DOMAINS, "terragrunt.hcl"));
                const domainModuleHCLPaths = Array.from(glob.scanSync(environmentsDir));
                for (const hclPath of domainModuleHCLPaths) {
                    const moduleDirectory = dirname(hclPath);
                    const {environment_dir: envDir, region_dir: regionDir, environment} = await getPanfactumConfig({context, directory: moduleDirectory})
                    if(!envDir){
                        throw new CLIError("Module is not in a valid environment directory.")
                    } else if (!regionDir){
                        throw new CLIError("Module is not in a valid region directory.")
                    }
                    subtasks.add({
                        title: applyColors(`Get registered domains ${environment}`, {highlights: [{phrase: environment!, style: "subtle"}]}),
                        task: async () => {                    
                            const moduleOutput = await terragruntOutput({
                                context,
                                environment: envDir,
                                region: regionDir,
                                module: MODULES.AWS_REGISTERED_DOMAINS,
                                validationSchema: REGISTERED_DOMAINS_MODULE_OUTPUT_SCHEMA,
                              });
                    
                            Object.entries(moduleOutput.zones.value).forEach(([domain, {zone_id: zoneId}]) => {
                                domainConfigs[domain] = {
                                    domain,
                                    zoneId,
                                    recordManagerRoleARN: moduleOutput.record_manager_role_arn.value,
                                    envDir,
                                    envName: environment!,
                                    module: MODULES.AWS_REGISTERED_DOMAINS
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