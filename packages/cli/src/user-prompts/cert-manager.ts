import { input } from "@inquirer/prompts";
import pc from "picocolors";

export async function certManagerPrompts() {
  const alertEmail = await input({
    message: pc.magenta(
      "This email will receive notifications if your certificates fail to renew.\n" +
        "Enter an email that is actively monitored to prevent unexpected service disruptions.\n" +
        "->"
    ),
    required: true,
  });

  return { alertEmail };
}
