import type { PanfactumContext } from "@/util/context/context";

export async function hasExistingAWSOrg(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    explainer: `
        Are your existing AWS accounts managed by an AWS Organization?
        
        If you aren't sure, see these docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html
    `,
    message: "Have existing org?",
    choices: [
      {
        name: "Yes:  Our accounts are part of the same AWS Organization.",
        value: true,
      },
      {
        name: "No:   Our existing accounts are standalone.",
        value: false,
      }
    ],
    default: true,
  });
}