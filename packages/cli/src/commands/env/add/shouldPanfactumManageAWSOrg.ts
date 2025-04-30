import pc from "picocolors"
import type { PanfactumContext } from "@/util/context/context";

export async function shouldPanfactumManageAWSOrg(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    explainer: `
    We recommend using Panfactum to manage your AWS organization to automate the account creation process
    for new environments and ensure maximum compatibility with Panfactum installations.
    `,
    message: `Would you like to allow Panfactum to configure your AWS Organization?`,
    choices: [
      {
        name: "Yes:  Use Panfactum to automate AWS account management.",
        value: true,
      },
      {
        name: `No:   I am an expert. ${pc.yellow("(WARNING: may not be fully compatible with automated installers)")}`,
        value: false,
      }
    ],
    default: true,
  });
}