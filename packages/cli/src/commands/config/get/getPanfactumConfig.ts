import { dirname } from "node:path";
import * as yaml from "yaml";
import { z } from "zod";
import type { PanfactumContext } from "../../../context";
import { awsRegions } from "../../../util/aws-regions";
import pc from "picocolors";

const AWS_REGION = z
.string()
.refine(region => (awsRegions as readonly string[]).includes(region), {
  message: "Not a valid AWS region"
})
.optional()

const PANFACTUM_CONFIG_SCHEMA = z.object({
  
  // Global Settings
  control_plane_domain: z.string().optional(),

  // Misc Metadata 
  sla_target: z.number().int().min(1).max(3).optional(),
  extra_tags: z.record(z.string(), z.any()).optional(),

  // Environment Settings
  environment: z.string().optional(),
  environment_suddomain: z.string().optional(),

  // Region Settings
  region: z.string().optional(),

  // Inputs
  extra_inputs: z.record(z.string(), z.any()).optional(),
  
  // Module Source
  version: z.string().optional(),
  pf_stack_version: z.string().optional(),
  pf_stack_local_path: z.string().optional(),
  pf_stack_local_use_relative: z.boolean().optional(),
  module: z.string().optional(),
  
  // State Backend Setup
  tf_state_account_id: z.string().optional(),
  tf_state_profile: z.string().optional(),
  tf_state_region: AWS_REGION,
  tf_state_bucket: z.string().optional(),
  tf_state_lock_table: z.string().optional(),
  
  // AWS Provider
  aws_account_id: z.string().optional(),
  aws_profile: z.string().optional(),
  aws_region: AWS_REGION,
  aws_secondary_account_id: z.string().optional(),
  aws_secondary_profile: z.string().optional(),
  aws_secondary_region: AWS_REGION,
  
  // Kubernetes Provider
  kube_api_server: z.string().optional(),
  kube_name: z.string().optional(),
  kube_subdomain: z.string().optional(),
  kube_config_context: z.string().optional(),
  
  // Vault Provider
  vault_addr: z.string().optional(),
  
  // Authentik Provider
  authentik_url: z.string().optional(),
});
type InputValues = z.infer<typeof PANFACTUM_CONFIG_SCHEMA>
type OutputValues = InputValues & {
  environment_domain?: string;
  kube_domain?: string;
}

const CONFIG_FILES = [
  "module.user.yaml",
  "module.yaml",
  "region.user.yaml",
  "region.yaml",
  "environment.user.yaml",
  "environment.yaml",
  "global.user.yaml",
  "global.yaml"
] as const;

export const getPanfactumConfig = async ({
  context,
  directory = process.cwd()
}: {
  context: PanfactumContext;
  directory?: string
}): Promise<OutputValues> => {

  // Get the actual file contents for each config file
  const configFileValues: Partial<{[fileName in typeof CONFIG_FILES[number]]: InputValues}> = {}
  const searchPromises: Array<Promise<void>> = []
  let currentDir = directory
  while (currentDir !== context.repoVariables.repo_root && currentDir !== "/") {
    CONFIG_FILES.forEach(fileName => {
      searchPromises.push((async () => {
        const filePath = `${currentDir}/${fileName}`;
        if (await Bun.file(filePath).exists()) {
          try {
            configFileValues[fileName] = await readConfigFile(filePath)
          } catch(e) {
            if (e instanceof z.ZodError) {
              e.errors.forEach(error => {
                context.stderr.write(pc.yellow(`Warning: Invalid config value '${error.path.join('.')}' in ${filePath}: ${error.message}\n`))
              })
            } else {
              throw e;
            }
          }
        }
      })())
    })
    currentDir = dirname(currentDir);
  }
  await Promise.all(searchPromises)

  // Merge all the values
  let values: OutputValues = {}
  for (const fileName of CONFIG_FILES) {
    const toMerge = configFileValues[fileName]
    if(toMerge){
      values = {
        ...values,
        ...toMerge,
        extra_tags: {
          ...(values.extra_tags ?? {}),
          ...(toMerge.extra_tags ?? {})
        },
        extra_inputs: {
          ...(values.extra_inputs ?? {}),
          ...(toMerge.extra_inputs ?? {})
        }
      }
    }
  }

  // Provide defaults
  const inEnvDir = directory.startsWith(context.repoVariables.environments_dir)
  const parts = inEnvDir ? directory.substring(context.repoVariables.environments_dir.length + 1).split("/") : []
  if(values.tf_state_account_id === undefined){
    values.tf_state_account_id = values.aws_account_id
  }
  if(values.tf_state_profile === undefined){
    values.tf_state_profile = values.aws_profile
  }
  if(values.aws_secondary_account_id === undefined){
    values.aws_secondary_account_id = values.aws_account_id
  }
  if(values.aws_secondary_profile === undefined){
    values.aws_secondary_profile = values.aws_profile
  }
  if(values.pf_stack_local_use_relative === undefined){
    values.pf_stack_local_use_relative = true
  }
  if(values.extra_tags === undefined){
    values.extra_tags = {}
  }
  if(values.extra_inputs === undefined){
    values.extra_inputs = {}
  }
  if(values.environment === undefined && parts.length >= 1){
    values.environment = parts[0]
  }
  if(values.region === undefined && parts.length >= 2){
    values.region = parts[1]
  }
  if(values.module === undefined && parts.length >= 3){
    values.module = parts[2]
  }
  if(values.kube_name === undefined){
    if(values.kube_config_context !== undefined){
      values.kube_name = values.kube_config_context // For backwards compatibility
    } else if (parts.length >= 2) {
      values.kube_name = `${values.environment}-${values.region}`
    }
  }
  if(values.kube_config_context === undefined){
    values.kube_config_context = values.kube_name
  }
  if(values.kube_subdomain === undefined && values.region !== undefined){
    values.kube_subdomain = `${values.region.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`
  }
  if(values.environment_suddomain === undefined && values.environment !== undefined){
    values.environment_suddomain = `${values.environment.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`
  }
  if(values.sla_target === undefined){
    values.sla_target = 3
  }
  if(values.version === undefined){
    values.version = "local"
  }


  // Provide computed values
  if(values.control_plane_domain && values.environment_suddomain){
    values.environment_domain = `${values.environment_suddomain}.${values.control_plane_domain}`
  }
  if(values.environment_domain && values.kube_subdomain){
    values.kube_domain = `${values.kube_subdomain}.${values.environment_domain}`
  }

  return values
};



async function readConfigFile(filePath: string): Promise<z.infer<typeof PANFACTUM_CONFIG_SCHEMA>>{
    if (filePath === undefined) return {};


    const fileContent = await Bun.file(filePath).text();
    
    // Skip if the file is empty or only contains comments
    const nonCommentLines = fileContent
      .split("\n")
      .filter((line) => !line.trim().startsWith("#") && line.trim() !== "");
    if (nonCommentLines.length === 0) {
      return {};
    }

    const parsedYaml = yaml.parse(fileContent);
    if (parsedYaml !== undefined) {
      return PANFACTUM_CONFIG_SCHEMA.parse(parsedYaml);
    }

    return {}
  }