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
    validate: (value) => {
      // From https://emailregex.com/
      const emailRegex =
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      if (!emailRegex.test(value)) {
        return "Please enter a valid email address";
      }
      return true;
    },
  });

  return { alertEmail };
}
