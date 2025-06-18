import { join, resolve } from "node:path";
import yaml from "yaml";
import { z } from "zod";
import { CLIError, PanfactumZodError } from '@/util/error/error';
import { REPO_CONFIG_FILE, REPO_USER_CONFIG_FILE } from "./constants";
import { getRoot } from "./getRoot";
import { PANFACTUM_YAML_SCHEMA } from "./schemas";

// Returns repository variables as a JSON payload so that they can
// be referenced in other scripts
//
// It also performs the following mutations:
// - adds default values
// - resolves _dir variables to their absolute path on the local system
// - adds the repo_root variable
// - adds the iac_dir_from_root variable which is the original value of iac_dir before being resolved to an absolute path
type RepoVariables = z.infer<typeof PANFACTUM_YAML_SCHEMA> & { iac_relative_dir?: string, repo_root: string }
export const getRepoVariables = async (cwd: string): Promise<RepoVariables> => {
  const repoRootPath = await getRoot(cwd);

  //####################################################################
  // Step 2: Read in the panfactum.yaml
  //####################################################################
  const configFile = join(repoRootPath, REPO_CONFIG_FILE);
  if (!(await Bun.file(configFile).exists())) {
    throw new CLIError(`Repo configuration file does not exist at ${configFile}`);
  }

  const userConfigFile = join(repoRootPath, REPO_USER_CONFIG_FILE);

  const fileContent = await Bun.file(configFile).text()
    .catch((error: unknown) => {
      throw new CLIError(`Failed to read repo configuration file at ${configFile}`, error);
    });
  
  let values: unknown;
  try {
    values = yaml.parse(fileContent);
  } catch (error) {
    throw new CLIError(`Invalid YAML syntax in repo configuration file at ${configFile}`, error);
  }

  if ((await Bun.file(userConfigFile).exists())) {
    const userFileContent = await Bun.file(userConfigFile).text()
      .catch((error: unknown) => {
        throw new CLIError(`Failed to read user configuration file at ${userConfigFile}`, error);
      });
    
    let userValues: unknown;
    try {
      userValues = yaml.parse(userFileContent);
    } catch (error) {
      throw new CLIError(`Invalid YAML syntax in user configuration file at ${userConfigFile}`, error);
    }
    
    // Ensure both values are objects before spreading
    if (typeof values === 'object' && values !== null && typeof userValues === 'object' && userValues !== null) {
      values = { ...values, ...userValues };
    }
  }

  //####################################################################
  // Step 3: Validate required variables & set defaults
  //####################################################################
  const parseResult = PANFACTUM_YAML_SCHEMA.safeParse(values);
  if (!parseResult.success) {
    throw new PanfactumZodError(
      `Invalid configuration in repo config file`,
      configFile,
      parseResult.error
    );
  }
  
  const validatedValues: RepoVariables = { ...parseResult.data, repo_root: repoRootPath };

  //####################################################################
  // Step 4: Save the relative IaC dir (needed for panfactum.hcl)
  //####################################################################
  validatedValues["iac_relative_dir"] = validatedValues["iac_dir"]

  //####################################################################
  // Step 5: Resolve directories
  //####################################################################
  const dirKeys = [
    "environments_dir",
    "iac_dir",
    "aws_dir",
    "kube_dir",
    "ssh_dir",
    "buildkit_dir",
    "nats_dir",
  ] as const;
  for (const key of dirKeys) {
    validatedValues[key] = resolve(repoRootPath, validatedValues[key]);
  }

  return validatedValues;
};
