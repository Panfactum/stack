import { select } from "@inquirer/prompts";
import pc from "picocolors"
import type { PanfactumContext } from "@/context/context";

export async function shouldCreateAWSOrg(context: PanfactumContext): Promise<boolean> {

  context.logger.log(
    `We recommend letting Panfactum create an AWS Organization to fully automate the environment\n` +
            `intallation process and ensure maximum compatibility with the Panfactum framework.`,
            {leadingNewlines: 1, trailingNewlines: 1} 
  )
    return select({
        message:
          pc.magenta(
            `Would you like to create an AWS Organization?\n` 
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