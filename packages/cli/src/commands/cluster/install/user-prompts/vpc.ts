import { input } from "@inquirer/prompts";
import pc from "picocolors";

export async function vpcPrompts({ environment }: { environment: string }) {
  // VPC information https://panfactum.com/docs/edge/guides/bootstrapping/aws-networking#deploy-the-aws-vpc-module
  // Prompt for VPC name
  const vpcName = await input({
    message: pc.magenta("Enter a name for your VPC:"),
    default: `panfactum-${environment}`,
  });

  // Prompt for VPC description
  const vpcDescription = await input({
    message: pc.magenta("Enter a description for your VPC:"),
    default: `Panfactum VPC for the ${environment} environment`,
  });

  return { vpcName, vpcDescription };
}
