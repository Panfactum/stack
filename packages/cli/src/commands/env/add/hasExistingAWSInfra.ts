import type { PanfactumContext } from "@/util/context/context";

export async function hasExistingAWSInfra(context: PanfactumContext): Promise<boolean> {
  return context.logger.select({
    message: "Do you have existing AWS accounts?",
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