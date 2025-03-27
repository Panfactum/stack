import { input, number } from "@inquirer/prompts";
import pc from "picocolors";

export async function vaultPrompts() {
  const vaultDomain = await input({
    message: pc.magenta(
      "Enter the domain you want to use for your Vault instance.\n\n" +
        "This should be a subdomain of the environment's domain that was setup during the DNS step.\n" +
        "https://panfactum.com/docs/edge/guides/bootstrapping/dns\n" +
        "e.g. if this is the development environment, the domain could be vault.dev.yourdomain.com\n" +
        "->"
    ),
    required: true,
    validate: (value) => {
      // Check if domain is empty
      if (!value.trim()) {
        return "Domain cannot be empty";
      }

      // Check for valid domain format
      const domainRegex =
        /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(value)) {
        return "Invalid domain format. Domain should be in format like vault.dev.yourdomain.com";
      }

      // Check for minimum number of subdomains (at least 3 parts for vault.something.tld)
      const parts = value.split(".");
      if (parts.length < 3) {
        return "Domain should be a subdomain (e.g., vault.dev.yourdomain.com)";
      }

      return true;
    },
  });

  const recoveryShares = await number({
    message: pc.magenta(
      "Enter how many people do you want to be superusers of Vault.\n" +
        "This is highly dependent on organization size, but we recommend the following:\n" +
        "1 if you are a solo operator\n" +
        "2 if you have at least one other person working on infrastructure (to reduce your bus factor)\n" +
        "and no more than 5 at the largest organization size (to minimize the burden of regular key rotation).\n" +
        "->"
    ),
    required: true,
    min: 1,
    max: 5,
  });

  const recoveryThreshold = await number({
    message: pc.magenta(
      "Enter how many superusers must work together to gain root access to Vault.\n" +
        "It can be tempting to make this a high number,\n" +
        "but you will need these keys fairly regularly (expect about once per quarter).\n" +
        "We recommend in sensitive environments you use 2 so there is at least one check on root access.\n" +
        "In less sensitive environments, you can make this 1 for convenience.\n" +
        "->"
    ),
    required: true,
    min: recoveryShares! > 1 ? 2 : 1,
  });

  return { vaultDomain, recoveryShares, recoveryThreshold };
}
