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
        name: "Yes",
        value: true,
        description: "Use Panfactum to simplify AWS account management."
      },
      {
        name: `No`,
        value: false,
        description: `For experts only. ${pc.yellow("(WARNING: may not be fully compatible with automated installers)")}`
      }
    ],
    default: true,
  });
}