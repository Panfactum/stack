import type { PanfactumContext } from "@/util/context/context";

export async function hasExistingAWSOrg(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    explainer: `
        Do you have existing AWS accounts managed by an AWS Organization?
        
        If you aren't sure, see these docs: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html
    `,
    message: "Already using an AWS Organization?",
    choices: [
      {
        name: "Yes",
        description: "You have existing accounts managed by an AWS Organization.",
        value: true,
      },
      {
        name: "No",
        description: "You do not have existing accounts or they are not managed by an AWS Organization.",
        value: false,
      }
    ],
    default: true,
  });
}