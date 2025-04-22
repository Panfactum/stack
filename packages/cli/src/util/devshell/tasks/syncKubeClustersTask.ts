import {join, dirname} from "node:path";
import { Glob } from "bun";
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { applyColors } from "@/util/colors/applyColors";
import { CLIError } from "@/util/error/error";
import { createDirectory } from "@/util/fs/createDirectory";
import { getLastPathSegments } from "@/util/getLastPathSegments";
import { MODULES } from "@/util/terragrunt/constants";
import { terragruntOutput } from "@/util/terragrunt/terragruntOutput";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { updateKubeConfig, type CLUSTERS_FILE_SCHEMA } from "../updateKubeConfig";
import type { PanfactumContext } from "@/context/context";
import type { ListrTask } from "listr2";


interface TaskContext {
    clusterInfo: {
        caData: string,
        url: string;
        name: string;
        regionDir: string;
        envDir: string;
    }[]
}

export async function buildSyncKubeClustersTask<T extends {}>(inputs: {context: PanfactumContext}): Promise<ListrTask<T>>{

    const {context} = inputs;


    const EKS_MODULE_OUTPUT_SCHEMA = z.object({
        cluster_ca_data: z.object({
          sensitive: z.boolean(),
          type: z.string(),
          value: z.string().base64(),
        }),
        cluster_url: z.object({ value: z.string() }),
        cluster_name: z.object({ value: z.string() }),
        cluster_region: z.object({ value: z.string() }),
      })


    return {
        title: "Sync Kubernetes Clusters credentials to DevShell",
        task: async (_, parentTask) => {

            const { kube_dir: kubeDir, environments_dir: environmentsDir } = context.repoVariables;
            const clustersYAMLPath = join(kubeDir, "clusters.yaml")
            const kubeConfigPath = join(kubeDir, "config")

            ///////////////////////////////////////////////////////
            // Check if there are any EKS modules; if no, skip
            ///////////////////////////////////////////////////////
            const glob = new Glob(join(environmentsDir, "**", MODULES.AWS_EKS, "terragrunt.hcl"));
            const eksHCLPaths = Array.from(glob.scanSync(environmentsDir));
            if(eksHCLPaths.length === 0){
                parentTask.skip(applyColors("Skipped sync Kubernetes Clusters credentials to DevShell No clusters found", {
                    highlights: [
                        {phrase: "No clusters found", style: "subtle"}
                    ]}))
                return
            } 

            await createDirectory(kubeDir)
            const subtasks = parentTask.newListr<TaskContext>([], {
                ctx: {
                    clusterInfo: []
                }
            })

            ///////////////////////////////////////////////////////
            // Add subtasks for fetching the module outputs
            ///////////////////////////////////////////////////////
            eksHCLPaths.forEach((eksHCLPath) => {
                const moduleDirectory = dirname(eksHCLPath);
                const clusterId = getLastPathSegments(moduleDirectory, 3);
                subtasks.add({
                    title: applyColors(`Retrieve cluster info ${clusterId}`, {highlights: [{phrase: clusterId, style: "subtle"}]}),
                    task: async (ctx, task) => {
                        const {environment_dir: envDir, region_dir: regionDir} = await getPanfactumConfig({context, directory: moduleDirectory})

                        if(!envDir){
                            throw new CLIError("Module is not in a valid environment directory.")
                        } else if (!regionDir){
                            throw new CLIError("Module is not in a valid region directory.")
                        }

                        const moduleOutput = await terragruntOutput({
                            context,
                            environment: envDir,
                            region: regionDir,
                            module: MODULES.AWS_EKS,
                            validationSchema: EKS_MODULE_OUTPUT_SCHEMA,
                          });
                          const name = moduleOutput.cluster_name.value;
                          ctx.clusterInfo.push({
                            caData: globalThis.atob(
                                moduleOutput.cluster_ca_data.value
                              ),
                            name,
                            url: moduleOutput.cluster_url.value,
                            regionDir,
                            envDir
                          })
                
                          task.title = applyColors(`Retrieved ${name} cluster info ${clusterId}`, {
                            highlights: [
                                {phrase: name, style: "important"},
                                {phrase: clusterId, style: "subtle"}
                            ]
                        })

                    }
                })
            })

            ///////////////////////////////////////////////////////
            // Write the configuration files
            ///////////////////////////////////////////////////////
            subtasks.add({
                title: applyColors(`Syncing DevShell configuration ${clustersYAMLPath}`, {highlights: [{style: "subtle", phrase: clustersYAMLPath}]}),
                task: async (ctx) => {
                    const clusterInfo: z.infer<typeof CLUSTERS_FILE_SCHEMA> = {}
                    for (const {name, regionDir, envDir, url, caData} of ctx.clusterInfo){
                        clusterInfo[name] = {
                            envDir,
                            url,
                            regionDir,
                            caData: globalThis.btoa(caData)
                        }
                    }
                    await writeYAMLFile({context, contents: clusterInfo, overwrite: true, path: clustersYAMLPath})
                }
            })

            ///////////////////////////////////////////////////////
            // Update kubeconfig
            ///////////////////////////////////////////////////////
            subtasks.add({
                title: applyColors(`Updating Kubeconfig ${kubeConfigPath}`, {highlights: [{style: "subtle", phrase: kubeConfigPath}]}),
                task: async () => {
                    await updateKubeConfig({context})
                }
            })

            return subtasks;
        }
    }
}