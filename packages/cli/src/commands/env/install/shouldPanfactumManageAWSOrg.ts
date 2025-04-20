import { select } from "@inquirer/prompts";
import pc from "picocolors"
import type { PanfactumContext } from "@/context/context";

export async function shouldPanfactumManageAWSOrg(context: PanfactumContext): Promise<boolean> {

  context.logger.log(
    `We recommend using Panfactum to manage your AWS organization to automate the account creation process\n` +
            `for new environments and ensure maximum compatibility with Panfactum installations.`,
            {leadingNewlines: 1, trailingNewlines: 1} 
  )
    return select({
        message:
          pc.magenta(
            `Would you like to allow Panfactum to configure your AWS Organization?\n` 
          ),
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