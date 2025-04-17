import type { Checkpointer } from "./checkpointer";
import type { PanfactumContext } from "@/context/context";

export interface InstallClusterStepOptions {
  awsProfile: string;
  clusterPath: string;
  environmentPath: string;
  environment: string;
  kubeDomain: string;
  region: string;
  context: PanfactumContext;
  checkpointer: Checkpointer;
  slaTarget: 1 | 2 | 3;
  stepNum: number;
}
