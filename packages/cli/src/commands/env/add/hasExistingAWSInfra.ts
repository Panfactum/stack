import type { PanfactumContext } from "@/context/context";

export async function hasExistingAWSInfra(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    message: "Do you have existing AWS infrastructure?",
    choices: [

      {
        name: "Yes:  Integrate with existing AWS accounts.",
        value: true,
      },
      {
        name: "No:   Start from scratch.",
        value: false,
      },

    ],
    default: false,
  });
}