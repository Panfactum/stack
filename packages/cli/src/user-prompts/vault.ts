import { input } from "@inquirer/prompts";
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

  return { vaultDomain };
}
