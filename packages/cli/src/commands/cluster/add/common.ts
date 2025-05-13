import type { PanfactumContext } from "@/util/context/context";
import { type TGConfigFile } from "@/util/config/schemas.ts";
import { getPanfactumConfig } from "@/util/config/getPanfactumConfig.ts";

export interface InstallClusterStepOptions {
  awsProfile: string;
  clusterPath: string;
  environmentPath: string;
  environment: string;
  kubeConfigContext?: string;
  domains: Record<string, { zone_id: string; record_manager_role_arn: string; }>;
  region: string;
  context: PanfactumContext;
  slaTarget: 1 | 2 | 3;
  config: TGConfigFile;
}

export async function refreshConfig(options: InstallClusterStepOptions): Promise<void> {
  // Get fresh config
  options.config = await getPanfactumConfig({
    context: options.context,
    directory: process.cwd(),
  });
}