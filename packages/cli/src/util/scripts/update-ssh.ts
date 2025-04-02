import { appendFileSync } from "fs";
import { mkdir } from "fs/promises";
import yaml from "yaml";
import { z } from "zod";
import { checkRepoSetup } from "./check-repo-setup";
import { getRepoVariables } from "./get-repo-variables";
import sshConfigExample from "../../files/ssh/config.example.yaml" with { type: "file" };
import { safeDirectoryExists } from "../safe-directory-exists";
import { safeFileExists } from "../safe-file-exists";
import { getSSHStateHash } from "./get-ssh-state-hash";
import { getModuleOutputs } from "./helpers/terragrunt/get-module-outputs";
import type { BaseContext } from "clipanion";

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function updateSSH({
  buildKnownHosts,
  context,
  verbose,
}: {
  buildKnownHosts?: boolean;
  context: BaseContext;
  verbose?: boolean;
}) {
  const repoVariables = await getRepoVariables({ context });
  const sshDir = repoVariables.ssh_dir;
  const environmentsDir = repoVariables.environments_dir;

  //############################################################
  // Step 1: Copy the static files
  //############################################################
  await mkdir(sshDir, { mode: 0o755, recursive: true });
  const configFileExample = Bun.file(sshConfigExample);
  await Bun.write(
    Bun.file(sshDir + "/config.example.yaml"),
    configFileExample,
    {
      mode: 0o644,
    }
  );

  //###########################################################
  // Step 2: Dynamically configure known_hosts
  //###########################################################

  if (buildKnownHosts) {
    if (await safeFileExists(sshDir + "/config.yaml")) {
      if (await safeFileExists(sshDir + "/known_hosts")) {
        const file = Bun.file(sshDir + "/known_hosts");
        await file.delete();
      }
      if (await safeFileExists(sshDir + "/connection_info")) {
        const file = Bun.file(sshDir + "/connection_info");
        await file.delete();
      }

      const configFile = yaml.parse(
        await Bun.file(sshDir + "/config.yaml").text()
      );
      const configFileSchema = z.object({
        bastions: z.array(
          z.object({
            module: z.string(),
            name: z.string(),
            vault: z.string(),
          })
        ),
      });
      const validatedConfigFile = configFileSchema.parse(configFile);
      const numberOfBastions = validatedConfigFile.bastions.length;

      for (let i = 0; i < numberOfBastions; i++) {
        const bastion = validatedConfigFile.bastions[i];
        // This shouldn't happen but makes the type checker happy
        if (!bastion) {
          return;
        }
        const modulePath = `${environmentsDir}/${bastion.module}`;
        const name = bastion.name;

        if (!(await safeDirectoryExists(modulePath))) {
          context.stderr.write(`Error: No module at ${modulePath}!\n`);
          throw new Error(`No module at ${modulePath}!`);
        }

        context.stderr.write(
          `Updating ${sshDir}/known_hosts and ${sshDir}/connection_info with values from ${modulePath}...\n`
        );

        const moduleOutputs = getModuleOutputs({
          context,
          modulePath,
          validationSchema: z.object({
            bastion_host_public_key: z.object({
              sensitive: z.boolean(),
              type: z.string(),
              value: z.string(),
            }),
            bastion_domains: z.object({
              sensitive: z.boolean(),
              type: z.array(z.string()),
              value: z.array(z.string()),
            }),
            bastion_port: z.object({
              sensitive: z.boolean(),
              type: z.string(),
              value: z.number(),
            }),
          }),
          verbose,
        });

        const numberOfDomains = moduleOutputs.bastion_domains.value.length;
        for (let j = 0; j < numberOfDomains; j++) {
          const domain = moduleOutputs.bastion_domains.value[j];
          const publicKey = moduleOutputs.bastion_host_public_key.value;
          const port = moduleOutputs.bastion_port.value;

          appendFileSync(
            sshDir + "/known_hosts",
            `[${domain}]:${port} ${publicKey}`
          );
          appendFileSync(
            sshDir + "/connection_info",
            `${name} ${domain} ${port}`
          );
        }
      }

      context.stderr.write(
        `All hosts in ${sshDir}/known_hosts and ${sshDir}/connection_info updated.\n`
      );
    } else {
      context.stderr.write(
        `Warning: No configuration file exists at ${sshDir}/config.yaml Skipping credential setup...\n`
      );
    }
  }

  const stateHash = await getSSHStateHash({ context });
  await Bun.write(sshDir + "/state.lock", stateHash);

  context.stderr.write(`ssh config files in ${sshDir} were updated.\n`);

  if (process.env["PF_SKIP_CHECK_REPO_SETUP"] !== "1") {
    checkRepoSetup({ context });
  }
}
