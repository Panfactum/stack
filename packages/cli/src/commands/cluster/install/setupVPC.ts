import path from "node:path";
import { input } from "@inquirer/prompts";
import pc from "picocolors";
import { z } from "zod";
import { vpcNetworkTest } from "@/commands/aws/vpc-network-test/vpcNetworkTest";
import awsVpcTerragruntHcl from "@/templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { CLIError } from "@/util/error/error";
import { parseErrorHandler } from "@/util/error/parseErrorHandler";
import { execute } from "@/util/subprocess/execute";
import { VPC_DESCRIPTION, VPC_NAME } from "./checkpointer";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

const STEP_LABEL = "AWS VPC";
const STEP_NUMBER = 1;

const DESCRIBE_VPCS_SCHEMA = z.object({
  Vpcs: z.array(z.object({})),
});

export async function setupVPC(options: InstallClusterStepOptions) {
  const {
    awsProfile,
    checkpointer,
    context,
    environment,
    clusterPath,
    region,
  } = options;

  try {
    /***************************************************
     * Check if setup is needed
     ***************************************************/
    const setupVPCStepID = "setupVPC";
    if (await checkpointer.isStepComplete(setupVPCStepID)) {
      informStepComplete(context, STEP_LABEL, STEP_NUMBER);
      return;
    } else {
      informStepStart(context, STEP_LABEL, STEP_NUMBER);
    }

    /***************************************************
     * Get the user-provided config for VPC
     ***************************************************/
    let [name, description] = await Promise.all([
      checkpointer.getSavedInput("vpcName"),
      checkpointer.getSavedInput("vpcDescription"),
    ]);

    if (!name) {
      name = await input({
        message: pc.magenta("Enter a name for your VPC:"),
        default: `panfactum-${environment}-${region}`,
        required: true,
        validate: async (value) => {
          const { error } = VPC_NAME.safeParse(value);
          if (error) {
            return error?.issues[0]?.message ?? "Invalid name";
          } else {
            const vpcListCommand = [
              "aws",
              "ec2",
              "describe-vpcs",
              `--region=${region}`,
              `--filters=Name=tag:Name,Values=${value}`,
              "--output=json",
              `--profile=${awsProfile}`,
              "--no-cli-pager",
            ];

            context.logger.log(
              "vpc list command: " + vpcListCommand.join(" "),
              {
                level: "debug",
              }
            );

            const { stdout, stderr } = await execute({
              command: vpcListCommand,
              context: context,
              workingDirectory: clusterPath,
            });

            context.logger.log("aws ec2 describe-vps stdout: " + stdout, {
              level: "debug",
            });
            context.logger.log("aws ec2 describe-vps stderr: " + stderr, {
              level: "debug",
            });

            let vpcList;
            try {
              const vpc = JSON.parse(stdout);
              vpcList = DESCRIBE_VPCS_SCHEMA.parse(vpc);
            } catch (e) {
              parseErrorHandler({
                error: e,
                genericErrorMessage:
                  "Failed checking if VPC name is already in use.",
                zodErrorMessage:
                  "Failed checking if VPC name is already in use.",
                command: vpcListCommand.join(" "),
              });
            }

            if (vpcList?.Vpcs.length && vpcList.Vpcs.length > 0) {
              return `A VPC already exists in AWS with the name ${value}. Please choose a different name.`;
            } else {
              return true;
            }
          }
        },
      });

      checkpointer.updateSavedInput("vpcName", name);
    }

    if (!description) {
      description = await input({
        message: pc.magenta("Enter a description for your VPC:"),
        default: `Panfactum VPC for the ${environment} environment in the ${region} region`,
        required: true,
        validate: (value) => {
          const { error } = VPC_DESCRIPTION.safeParse(value);
          if (error) {
            return error.issues[0]?.message ?? "Invalid description";
          } else {
            return true;
          }
        },
      });
      checkpointer.updateSavedInput("vpcDescription", description);
    }

    /***************************************************
     * Setup VPC IaC
     ***************************************************/
    const vpcModule = "aws_vpc";
    await deployModule({
      ...options,
      stepId: "setupVPCIaC",
      stepName: "Infrastructure-as-code Setup",
      moduleDirectory: vpcModule,
      terraguntContents: awsVpcTerragruntHcl,
      stepNum: STEP_NUMBER,
      subStepNum: 1,
      hclUpdates: {
        vpc_name: name,
        vpc_description: description,
      },
    });

    /***************************************************
     * Perform the VPC Network Test
     ***************************************************/
    const subStepLabel = "VPC Network Test";
    const subStepNumber = 2;
    const vpcNetworkTestStepId = "vpcNetworkTest";
    if (await checkpointer.isStepComplete(vpcNetworkTestStepId)) {
      informStepComplete(context, subStepLabel, STEP_NUMBER, subStepNumber);
    } else {
      informStepStart(context, subStepLabel, STEP_NUMBER, subStepNumber);
      await vpcNetworkTest({
        awsProfile,
        context,
        modulePath: path.join(clusterPath, vpcModule),
      });
      await checkpointer.setStepComplete(vpcNetworkTestStepId);
    }

    /***************************************************
     * Mark Finished
     ***************************************************/
    await checkpointer.setStepComplete(setupVPCStepID);
  } catch (e) {
    throw new CLIError(`Deploying ${STEP_LABEL} failed`, e);
  }
}
