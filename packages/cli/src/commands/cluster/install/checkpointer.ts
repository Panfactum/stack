import { z, ZodError } from "zod";
import { CLIError } from "@/util/error/error";
import { fileExists } from "@/util/fs/fileExists";
import type { PanfactumContext } from "@/context/context";

export const VPC_NAME = z
  .string()
  .min(3, "VPC name must be at least 3 characters long")
  .max(100, "VPC name must be less than 100 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  );
export const VPC_DESCRIPTION = z
  .string()
  .min(3, "VPC description must be at least 3 characters long")
  .max(255, "VPC description must be less than 255 characters long")
  .regex(
    /^[a-zA-Z0-9_\- .:/=+@]+$/,
    "Must only contain spaces, the letters a-z (case-insensitive), numbers 0-9, and the following characters: _.:/=+-@"
  );
export const DOCKERHUB_USERNAME = z
  .string()
  .min(3, "DockerHub username must be at least 3 characters long")
  .max(63, "DockerHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  )
  .regex(/^(?!aws:).*$/i, "Cannot start with 'AWS:' (case insensitive)");
export const GITHUB_USERNAME = z
  .string()
  .min(3, "GitHub username must be at least 3 characters long")
  .max(63, "GitHub username must be less than 63 characters long")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Must only contain the letters a-z (case-insensitive), numbers 0-9, hyphens (-), and underscores (_)"
  );
export const CLUSTER_NAME = z
  .string()
  .min(3, "Cluster name must be at least 3 characters long")
  .max(63, "Cluster name must be less than 63 characters long")
  .regex(
    /^[a-z0-9-]+$/,
    "Must only contain the letters a-z (lowercase), numbers 0-9, and hyphens (-)"
  )
  .regex(
    /^[a-z0-9].*[a-z0-9]*$/,
    "Must start and end with a letter a-z (lowercase) or number 0-9"
  );
export const CLUSTER_DESCRIPTION = z
  .string()
  .min(3, "Cluster description must be at least 3 characters long")
  .max(255, "Cluster description must be less than 255 characters long")
  .regex(
    /^[a-zA-Z0-9_\- .:/=+@]+$/,
    "Must only contain spaces, the letters a-z (case-insensitive), numbers 0-9, and the following characters: _.:/=+-@"
  )
  .regex(/^(?!aws:).*$/i, "Cannot start with 'AWS:' (case insensitive)");

const SAVED_INPUTS = z.object({
  slaTarget: z.number().min(1).max(3).int().optional(),
  vpcName: VPC_NAME.optional(),
  vpcDescription: VPC_DESCRIPTION.optional(),
  dockerHubUsername: DOCKERHUB_USERNAME.optional(),
  githubUsername: GITHUB_USERNAME.optional(),
  clusterName: CLUSTER_NAME.optional(),
  clusterDescription: CLUSTER_DESCRIPTION.optional(),
  vaultDomain: z.string().optional(),
  vaultRootToken: z.string().optional(),
  vaultAddress: z.string().optional(),
  certificateAlertEmail: z.string().optional(),
});

const STEPS = z.object({
  setupVPC: z.boolean().default(false).catch(false),
  setupVPCIaC: z.boolean().default(false).catch(false),
  vpcNetworkTest: z.boolean().default(false).catch(false),
  setupECRPullThroughCache: z.boolean().default(false).catch(false),
  setupEKS: z.boolean().default(false).catch(false),
  internalClusterNetworking: z.boolean().default(false).catch(false),
  setupCilium: z.boolean().default(false).catch(false),
  setupCoreDNS: z.boolean().default(false).catch(false),
  policyController: z.boolean().default(false).catch(false),
  kyvernoIaCSetup: z.boolean().default(false).catch(false),
  panfactumPoliciesIaCSetup: z.boolean().default(false).catch(false),
  ecrDeployment: z.boolean().default(false).catch(false),
  eksDeployment: z.boolean().default(false).catch(false),
  csiDrivers: z.boolean().default(false).catch(false),
  awsEBSCSIDriver: z.boolean().default(false).catch(false),
  setupVault: z.boolean().default(false).catch(false),
  vaultDeployment: z.boolean().default(false).catch(false),
  vaultOperatorInit: z.boolean().default(false).catch(false),
  setupVaultCoreResources: z.boolean().default(false).catch(false),
  vaultCoreResourcesDeployment: z.boolean().default(false).catch(false),
  setupCertManagement: z.boolean().default(false).catch(false),
  certManagerDeployment: z.boolean().default(false).catch(false),
  setupCertificateIssuers: z.boolean().default(false).catch(false),
  certIssuersDeployment: z.boolean().default(false).catch(false),
  certIssuersIACDeployment: z.boolean().default(false).catch(false),
  firstCertificateDeployment: z.boolean().default(false).catch(false),
  setupLinkerd: z.boolean().default(false).catch(false),
  linkerdDeployment: z.boolean().default(false).catch(false),
  linkerdControlPlaneChecks: z.boolean().default(false).catch(false),
  setupAutoscaling: z.boolean().default(false).catch(false),
  metricsServerDeployment: z.boolean().default(false).catch(false),
  vpaDeployment: z.boolean().default(false).catch(false),
  allResourcesUpdatedForVPA: z.boolean().default(false).catch(false),
  karpenterDeployment: z.boolean().default(false).catch(false),
  nodePoolsDeployment: z.boolean().default(false).catch(false),
  adjustNodePools: z.boolean().default(false).catch(false),
  schedulerDeployment: z.boolean().default(false).catch(false),
  kedaDeployment: z.boolean().default(false).catch(false),
  setupInboundNetworking: z.boolean().default(false).catch(false),
  deployExternalDns: z.boolean().default(false).catch(false),
  deployAwsLbController: z.boolean().default(false).catch(false),
  generateIngressSecret: z.boolean().default(false).catch(false),
  deployNginxIngress: z.boolean().default(false).catch(false),
  deployVaultIngress: z.boolean().default(false).catch(false),
  updateVaultAddress: z.boolean().default(false).catch(false),
  deployBastion: z.boolean().default(false).catch(false),
  configureBastionConnectivity: z.boolean().default(false).catch(false),
  setupMaintenanceControllers: z.boolean().default(false).catch(false),
  deployReloader: z.boolean().default(false).catch(false),
  deployNodeImageCaches: z.boolean().default(false).catch(false),
  deployPvcAutoresizer: z.boolean().default(false).catch(false),
  deployDescheduler: z.boolean().default(false).catch(false),
  deployExternalSnapshotter: z.boolean().default(false).catch(false),
  deployVelero: z.boolean().default(false).catch(false),
  setupCloudNativePG: z.boolean().default(false).catch(false),
  deployCloudNativePG: z.boolean().default(false).catch(false),
});

export type Step = keyof z.infer<typeof STEPS>;

const CHECKPOINT_SCHEMA = z.object({
  steps: STEPS,
  savedInputs: SAVED_INPUTS,
});

export class Checkpointer {
  checkpointFile: string;
  checkpointData: z.infer<typeof CHECKPOINT_SCHEMA> | undefined;
  context: PanfactumContext;

  constructor(context: PanfactumContext, checkpointFile: string) {
    this.context = context;
    this.checkpointFile = checkpointFile;
    this.checkpointData = undefined;
  }

  async save() {
    try {
      await Bun.write(
        this.checkpointFile,
        JSON.stringify(this.checkpointData, null, 2)
      );
    } catch (e) {
      throw new CLIError(
        `Failed to save checkpoint data to ${this.checkpointFile}`,
        e
      );
    }
  }

  resetDefaults() {
    return (this.checkpointData = CHECKPOINT_SCHEMA.parse({
      savedInputs: {},
      steps: {},
    }));
  }

  async load() {
    try {
      if (!(await fileExists(this.checkpointFile))) {
        return this.resetDefaults();
      }
      const rawData = await this.rawLoad();
      return (this.checkpointData = CHECKPOINT_SCHEMA.parse(rawData));
    } catch (e) {
      if (e instanceof ZodError) {
        for (const issue of e.issues) {
          this.context.logger.log(
            `Warning: Issue restoring checkpoint data ${issue.path.join(".")} for checkpoint file at ${this.checkpointFile}.`,
            { style: "warning" }
          );
        }
      } else if (e instanceof Error) {
        this.context.logger.log(`Warning: ${e.message}`, { style: "warning" });
      }
      return this.resetDefaults();
    }
  }

  private async rawLoad(): Promise<unknown> {
    try {
      return JSON.parse(await Bun.file(this.checkpointFile).text());
    } catch (e) {
      throw new CLIError(
        `Failed to load checkpoint data from ${this.checkpointFile}`,
        e
      );
    }
  }

  async getSavedInput(
    key: keyof z.infer<typeof SAVED_INPUTS>
  ): Promise<z.infer<typeof SAVED_INPUTS>[typeof key]> {
    if (this.checkpointData === undefined) {
      return (await this.load()).savedInputs[key];
    }
    return this.checkpointData.savedInputs[key];
  }

  async updateSavedInput(
    key: keyof z.infer<typeof SAVED_INPUTS>,
    value: NonNullable<z.infer<typeof SAVED_INPUTS>[typeof key]>
  ) {
    if (this.checkpointData === undefined) {
      const data = await this.load();
      data.savedInputs[key] = value;
    } else {
      this.checkpointData.savedInputs[key] = value;
    }
    await this.save();
  }

  async isStepComplete(step: Step) {
    if (this.checkpointData === undefined) {
      return (await this.load()).steps[step];
    }
    return this.checkpointData.steps[step];
  }

  async setStepComplete(step: Step) {
    if (this.checkpointData === undefined) {
      this.checkpointData = await this.load();
      this.checkpointData.steps[step] = true;
    }
    this.checkpointData.steps[step] = true;
    await this.save();
  }
}
