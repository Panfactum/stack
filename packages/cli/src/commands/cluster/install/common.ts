import type { PanfactumContext } from "@/context/context";

export interface InstallClusterStepOptions {
  awsProfile: string;
  clusterPath: string;
  environmentPath: string;
  environment: string;
  environmentDomain: string;
  kubeDomain: string;
  region: string;
  context: PanfactumContext;
  slaTarget: 1 | 2 | 3;
}
