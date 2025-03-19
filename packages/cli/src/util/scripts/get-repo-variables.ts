import path from "node:path";
import yaml from "yaml";
import { z } from "zod";
import { getRoot } from "./helpers/get-root";
import type { BaseContext } from "clipanion";

// Returns repository variables as a JSON payload so that they can
// be referenced in other scripts
//
// It also performs the following mutations:
// - adds default values
// - resolves _dir variables to their absolute path on the local system
// - adds the repo_root variable
// - adds the iac_dir_from_root variable which is the original value of iac_dir before being resolved to an absolute path
export const getRepoVariables = async ({
  context,
}: {
  context: BaseContext;
}) => {
  //####################################################################
  // Step 1: Get to the repository root (or root of panfactum.yaml if using reference env)
  //####################################################################
  const { root, gitRoot } = await getRoot();

  //####################################################################
  // Step 2: Read in the panfactum.yaml
  //####################################################################
  const configFile = `${root}/panfactum.yaml`;
  if (!(await Bun.file(configFile).exists())) {
    context.stderr.write(
      `Repo configuration file does not exist at ${configFile}`
    );
    throw new Error(`Repo configuration file does not exist at ${configFile}`);
  }

  const fileContent = await Bun.file(configFile).text();
  const values = yaml.parse(fileContent);

  //####################################################################
  // Step 3: Validate required variables & set defaults
  //####################################################################
  const panfactumYamlSchema = z
    .object({
      // Required fields
      repo_name: z.string({
        required_error: "repo_name must be set in panfactum.yaml",
      }),

      repo_primary_branch: z.string({
        required_error: "repo_primary_branch must be set in panfactum.yaml",
      }),

      repo_root: z.string().default(root),
      // Added and/or updated in the chained transform()
      iac_dir_from_root: z.string().optional(),
      iac_dir_from_git_root: z.string().optional(),

      repo_url: z
        .string({
          required_error: "repo_url must be set in panfactum.yaml",
        })
        .refine(
          (url) =>
            url.startsWith("git::https://") ||
            url.startsWith("github.com") ||
            url.startsWith("bitbucket.org"),
          {
            message:
              "repo_url must be a valid TF module source that uses HTTPS. See https://opentofu.org/docs/language/modules/sources.",
          }
        ),

      // Optional directory fields with path validation
      environments_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "environments_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "environments_dir must not contain a trailing /",
        })
        .default("environments"),

      iac_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "iac_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "iac_dir must not contain a trailing /",
        })
        .default("infrastructure"),

      aws_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "aws_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "aws_dir must not contain a trailing /",
        })
        .default(".aws"),

      kube_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "kube_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "kube_dir must not contain a trailing /",
        })
        .default(".kube"),

      ssh_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "ssh_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "ssh_dir must not contain a trailing /",
        })
        .default(".ssh"),

      buildkit_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "buildkit_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "buildkit_dir must not contain a trailing /",
        })
        .default(".buildkit"),

      nats_dir: z
        .string()
        .optional()
        .refine((dir) => !dir?.startsWith("/"), {
          message: "nats_dir must not contain a leading /",
        })
        .refine((dir) => !dir?.endsWith("/"), {
          message: "nats_dir must not contain a trailing /",
        })
        .default(".nats"),
    })
    .transform((values) => {
      values.iac_dir_from_root = values.iac_dir;

      // This is a bit of a hack to account for the case where the repo_root
      // is different from the git root dir which can occur in cases
      // like the reference system which is a subdirectory of a git repository
      const repoRoot = values.repo_root;
      const iacDirFromRoot = values.iac_dir_from_root;
      let iacDirFromGitRoot = "";

      if (repoRoot.startsWith(gitRoot)) {
        // Remove gitRoot prefix from repoRoot, then join with iacDirFromRoot
        const relativePath = repoRoot.replace(new RegExp(`^${gitRoot}/?`), "");
        iacDirFromGitRoot = [relativePath, iacDirFromRoot]
          .filter(Boolean)
          .join("/");
      } else {
        // Fallback if repoRoot is not within gitRoot (shouldn't happen in normal cases)
        iacDirFromGitRoot = iacDirFromRoot;
      }

      return {
        ...values,
        iac_dir_from_git_root: iacDirFromGitRoot,
      };
    });

  const validatedValues = panfactumYamlSchema.parse(values);

  //####################################################################
  // Step 4: Resolve directories
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
    validatedValues[key] = path.resolve(root, validatedValues[key]);
  }

  return validatedValues;
};
