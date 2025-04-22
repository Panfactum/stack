import { select } from "@inquirer/prompts";
import pc from "picocolors"
import type { PanfactumContext } from "@/context/context";

export async function hasExistingAWSInfra(_: PanfactumContext): Promise<boolean> {
    return select({
        message:
          pc.magenta(
            "Do you have existing AWS infrastructure?\n"
          ),
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