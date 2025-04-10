import path from "node:path";
import { input } from "@inquirer/prompts";
import pc from "picocolors";
import { vpcNetworkTest } from "@/commands/aws/vpc-network-test/vpcNetworkTest";
import awsVpcTerragruntHcl from "@/templates/aws_vpc_terragrunt.hcl" with { type: "file" };
import { CLIError } from "@/util/error/error";
import { VPC_DESCRIPTION, VPC_NAME } from "./checkpointer";
import { deployModule } from "./deployModule";
import { informStepComplete, informStepStart, informSubStepComplete, informSubStepStart } from "./messages";
import type { InstallClusterStepOptions } from "./common";

const STEP_LABEL = "AWS VPC"
const STEP_NUMBER = 1

export async function setupVPC(options: InstallClusterStepOptions) {
    const {
        checkpointer,
        context,
        environment,
        clusterPath
    } = options;

    try {

        /***************************************************
         * Check if setup is needed
         ***************************************************/
        const setupVPCStepID = "setupVPC"
        if (await checkpointer.isStepComplete(setupVPCStepID)) {
            informStepComplete(context, STEP_LABEL, STEP_NUMBER)
            return
        } else {
            informStepStart(context, STEP_LABEL, STEP_NUMBER)
        }

        /***************************************************
         * Get the user-provided config for VPC
         ***************************************************/
        let [name, description] = await Promise.all([
            checkpointer.getSavedInput("vpcName"),
            checkpointer.getSavedInput("vpcDescription")
        ])

        if (!name) {
            // TODO: add region to default?
            name = await input({
                message: pc.magenta("Enter a name for your VPC:"),
                default: `panfactum-${environment}`,
                required: true,
                validate: (value) => {
                    const { error } = VPC_NAME.safeParse(value)
                    if (error) {
                        return error.issues[0]?.message ?? "Invalid name"
                    } else {
                        // TODO: Validate that the VPC name is not already in use
                        return true
                    }
                }
            });


            checkpointer.updateSavedInput('vpcName', name)
        }

        if (!description) {
            // TODO: add region to default?
            description = await input({
                message: pc.magenta("Enter a description for your VPC:"),
                default: `Panfactum VPC for the ${environment} environment`,
                required: true,
                validate: (value) => {
                    const { error } = VPC_DESCRIPTION.safeParse(value)
                    if (error) {
                        return error.issues[0]?.message ?? "Invalid description"
                    } else {
                        return true
                    }
                }
            });
            checkpointer.updateSavedInput('vpcDescription', description)
        }


        /***************************************************
         * Setup VPC IaC
         ***************************************************/
        const vpcModule = "aws_vpc"
        await deployModule({
            ...options,
            stepId: "kyvernoIaCSetup",
            stepName: "Infrastructure-as-code Setup",
            moduleDirectory: vpcModule,
            terraguntContents: awsVpcTerragruntHcl,
            stepNum: STEP_NUMBER,
            subStepNum: 1,
            hclUpdates: {
                "vpc_name": name,
                "vpc_description": description
            }
        })


        /***************************************************
         * Perform the VPC Network Test
         ***************************************************/

        const vpcNetworkTestStepId = "vpcNetworkTest"
        if (await checkpointer.isStepComplete(vpcNetworkTestStepId)) {
            informSubStepComplete("VPC Network Tests", STEP_NUMBER, "b", context)
        } else {
            informSubStepStart("VPC Network Tests", STEP_NUMBER, "b", context)
            await vpcNetworkTest({
                context,
                modulePath: path.join(clusterPath, vpcModule)
            });
            await checkpointer.setStepComplete(vpcNetworkTestStepId)
        }

        /***************************************************
        * Mark Finished
        ***************************************************/
        await checkpointer.setStepComplete(setupVPCStepID)

    } catch (e) {
        throw new CLIError(`Deploying ${STEP_LABEL} failed`, e)
    }

}