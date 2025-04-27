import pc from "picocolors"
import type { PanfactumContext } from "@/context/context";

export async function shouldCreateAWSOrg(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    explainer: `
      We recommend letting Panfactum create an AWS Organization to fully automate the environment
      intallation process and ensure maximum compatibility with the Panfactum framework.
    `,
    message: `Would you like to create an AWS Organization?`,
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