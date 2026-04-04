#!/usr/bin/env bun
// Generates the JSON Schema file for changelog log.yaml from the current codebase.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = process.env["REPO_ROOT"] ?? process.cwd();
const INFRASTRUCTURE_DIR = join(REPO_ROOT, "packages/infrastructure");
const CLI_COMMANDS_DIR = join(REPO_ROOT, "packages/cli/src/commands");
const LOCAL_DEV_SHELL_SCRIPTS_DIR = join(
  REPO_ROOT,
  "packages/nix/localDevShell/scripts"
);
const NIX_PACKAGES_SCRIPTS_DIR = join(
  REPO_ROOT,
  "packages/nix/packages/scripts"
);
const METADATA_YAML_PATH = join(INFRASTRUCTURE_DIR, "metadata.yaml");
const LOG_SCHEMA_OUTPUT_PATH = join(
  REPO_ROOT,
  "packages/website/src/content/changelog/log.schema.json"
);

// ---------------------------------------------------------------------------
// Types for metadata.yaml
// ---------------------------------------------------------------------------

interface IMetadataYaml {
  renamed_modules?: { old_name: string; new_name: string; motivation?: string }[];
  removed_modules?: { name: string; motivation?: string }[];
}

// ---------------------------------------------------------------------------
// Derive iac-module enum
//
// Includes:
//   - Current folder names under packages/infrastructure/
//   - old_name values from metadata.yaml renamed_modules
//   - name values from metadata.yaml removed_modules
// ---------------------------------------------------------------------------

function deriveIacModuleEnum(): string[] {
  const currentModules = readdirSync(INFRASTRUCTURE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let renamedOldNames: string[] = [];
  let removedNames: string[] = [];

  if (existsSync(METADATA_YAML_PATH)) {
    const rawContent = readFileSync(METADATA_YAML_PATH, "utf8");
    const metadata = parseYaml(rawContent) as IMetadataYaml | null;
    if (metadata !== null && metadata !== undefined) {
      renamedOldNames = (metadata.renamed_modules ?? []).map(
        (module) => module.old_name
      );
      removedNames = (metadata.removed_modules ?? []).map(
        (module) => module.name
      );
    }
  }

  return [
    ...new Set([...currentModules, ...renamedOldNames, ...removedNames]),
  ].sort();
}

// ---------------------------------------------------------------------------
// Derive cli enum
//
// Scans packages/cli/src/commands/**/*.ts files and extracts the static
// `paths` property from each command class to build the full command name.
// ---------------------------------------------------------------------------

function deriveCliEnum(): string[] {
  const commandPaths: string[] = [];

  function scanDir(dirPath: string): void {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name === "command.ts") {
        const content = readFileSync(fullPath, "utf8");
        // Extract the static paths declaration from each command file.
        // Patterns handled:
        //   static override paths = [['a', 'b', 'c']];
        //   static override paths = [["a", "b", "c"]];
        const pathsMatch = content.match(
          /static\s+override\s+paths\s*=\s*\[(\[[\s\S]*?\])\]/
        );
        if (pathsMatch?.[1]) {
          try {
            // Use JSON.parse after normalizing single quotes to double quotes
            const normalized = pathsMatch[1]
              .replace(/'/g, '"')
              .replace(/\s+/g, " ")
              .trim();
            const parsed = JSON.parse(normalized) as string[];
            if (Array.isArray(parsed)) {
              commandPaths.push(parsed.join(" "));
            }
          } catch {
            // Skip command files that cannot be parsed
          }
        }
      }
    }
  }

  scanDir(CLI_COMMANDS_DIR);
  return [...new Set(commandPaths)].sort();
}

// ---------------------------------------------------------------------------
// Derive devshell enum
//
// Collects binary names from:
//   1. Shell scripts in packages/nix/localDevShell/scripts/ (strip .sh)
//   2. Shell scripts in packages/nix/packages/scripts/ (strip .sh)
//   3. A static list of well-known binaries provided by nix packages
//      (since their binary names cannot be dynamically parsed from nix
//      expressions without running nix itself)
// ---------------------------------------------------------------------------

// Well-known binary names exposed by nix packages in the devshell.
// Sourced from the package lists in packages/nix/packages/default.nix and
// packages/nix/localDevShell/default.nix.
const NIX_PACKAGE_BINARIES: string[] = [
  "argo",
  "autossh",
  "aws",
  "aws-nuke",
  "bash",
  "bc",
  "buildctl",
  "cilium",
  "cmctl",
  "croc",
  "curl",
  "dig",
  "envsubst",
  "fzf",
  "getopt",
  "git",
  "git-lfs",
  "gzip",
  "hcl2json",
  "helm",
  "jq",
  "k9s",
  "kube-capacity",
  "kubectl",
  "kubectl-cnpg",
  "kubectl-evict-pod",
  "kubectx",
  "kustomize",
  "kyverno",
  "less",
  "linkerd",
  "lsof",
  "manifest-tool",
  "micro",
  "mktemp",
  "mtr",
  "nats",
  "nats-top",
  "nsc",
  "opensearch-cli",
  "parallel",
  "pf",
  "psql",
  "redis-cli",
  "rg",
  "rsync",
  "session-manager-plugin",
  "skopeo",
  "sops",
  "ssh",
  "step",
  "stern",
  "terraform-ls",
  "terragrunt",
  "tofu",
  "unzip",
  "vault",
  "velero",
  "whois",
  "yq",
  "zx",
];

function deriveDevshellEnum(): string[] {
  const scriptNames: string[] = [];

  function collectScripts(dirPath: string): void {
    if (!existsSync(dirPath)) {
      return;
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".sh")) {
        scriptNames.push(entry.name.slice(0, -3));
      }
    }
  }

  collectScripts(LOCAL_DEV_SHELL_SCRIPTS_DIR);
  collectScripts(NIX_PACKAGES_SCRIPTS_DIR);

  return [...new Set([...scriptNames, ...NIX_PACKAGE_BINARIES])].sort();
}

// ---------------------------------------------------------------------------
// Configuration file enum — static list of standard config file references
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Installer component enum — static list of installer artifacts
// ---------------------------------------------------------------------------

const INSTALLER_ENUM: string[] = ["install.sh"];

// ---------------------------------------------------------------------------
// CLI extra components — shared utilities that don't correspond to a command path
// ---------------------------------------------------------------------------

const CLI_EXTRA_COMPONENTS: string[] = ["logging"];

const CONFIGURATION_ENUM: string[] = [
  ".env",
  ".nats",
  ".terraformrc",
  ".terraformrc.dev",
  "clusters.yaml",
  "environment.secrets.yaml",
  "environment.user.yaml",
  "environment.yaml",
  "flake.nix",
  "global.secrets.yaml",
  "global.user.yaml",
  "global.yaml",
  "module.secrets.yaml",
  "module.user.yaml",
  "module.yaml",
  "panfactum.hcl",
  "panfactum.user.yaml",
  "panfactum.yaml",
  "region.secrets.yaml",
  "region.user.yaml",
  "region.yaml",
];

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

function buildLogSchema(
  iacModuleEnum: string[],
  cliEnum: string[],
  devshellEnum: string[],
  configurationEnum: string[],
  installerEnum: string[]
): object {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["summary"],
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description:
          "Brief one-line summary of the release, displayed in the accordion list view.",
      },
      skip: {
        type: "boolean",
        default: false,
        description:
          "When true, marks this release as one users should skip (e.g., a broken release). Displayed with a visual indicator in the changelog list.",
      },
      branch: {
        type: "string",
        description:
          "The git branch associated with this release (e.g., a stable release branch name).",
      },
      upgrade_instructions: {
        type: "string",
        pattern: "^.+\\.mdx$",
        description:
          "Relative path to an MDX file containing detailed upgrade/migration instructions. Omit entirely if the release has no upgrade steps. This content gets its own dedicated page accessible via an \"Upgrade Instructions\" button on the entry.",
      },
      highlights: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "List of important things to call out from this release. Displayed on the paginated changelog list page as the visible summary for each entry. Each item is inline markdown.",
      },
      changes: {
        type: "array",
        description:
          "Flat list of all changes in this release, each tagged with a type. Rendered only on the dedicated page for each release, not on the paginated list page.",
        items: {
          type: "object",
          required: ["type", "summary"],
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "breaking_change",
                "fix",
                "improvement",
                "addition",
                "deprecation",
              ],
              description: "The category of change.",
            },
            summary: {
              type: "string",
              pattern: "^[^ ]*( [^ ]*){0,19}$",
              description:
                "Inline markdown describing the change (20 words or fewer). Put detailed information in the description field.",
            },
            description: {
              type: "string",
              description:
                "Optional long-form markdown focused on recommendations the user should follow to adapt to this change. Use for actionable guidance such as configuration updates, code adjustments, or workflow changes the user should make in response. Supports full markdown syntax including headings, lists, code blocks, and links.",
            },
            action_items: {
              type: "array",
              items: { type: "string" },
              description:
                "List of discrete action items the user should complete in response to this change. Each string supports full markdown syntax.",
            },
            references: {
              type: "array",
              description:
                "List of references that either explain what motivated this change (e.g., the commit, PR, or issue that prompted it) or help users respond to it (e.g., documentation on affected APIs, migration guides, or relevant configuration options).",
              items: {
                type: "object",
                required: ["type", "summary", "link"],
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "internal-commit",
                      "external-commit",
                      "issue-report",
                      "external-docs",
                      "internal-docs",
                    ],
                    description:
                      "The kind of reference. 'internal-commit' is a commit in the Panfactum stack repository — link must be the full 40-character commit SHA. 'external-commit' is a link to a commit or pull request in an external repository. 'issue-report' is a link to a bug report, feature request, or discussion thread. 'external-docs' is a link to third-party documentation (e.g., Kubernetes, Terraform, Helm docs). 'internal-docs' is a link to a page on panfactum.com.",
                  },
                  summary: {
                    type: "string",
                    description: "Brief description of the reference.",
                  },
                  link: {
                    type: "string",
                    description:
                      "URL or path to the referenced resource. For internal-commit references, this must be the full 40-character commit SHA.",
                  },
                },
                allOf: [
                  {
                    if: {
                      properties: {
                        type: { const: "internal-commit" },
                      },
                    },
                    then: {
                      properties: {
                        link: {
                          type: "string",
                          pattern: "^[0-9a-f]{40}$",
                        },
                      },
                    },
                  },
                ],
              },
            },
            impacts: {
              type: "array",
              description: "List of components affected by this change.",
              items: {
                type: "object",
                required: ["type", "component"],
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: ["iac-module", "cli", "devshell", "configuration", "installer"],
                    description:
                      "The kind of component affected by this change.",
                  },
                  component: {
                    type: "string",
                    description:
                      "Identifies the specific component affected. Valid values depend on type (see conditional schemas below).",
                  },
                  summary: {
                    type: "string",
                    description:
                      "Brief inline markdown summarizing how this component is affected by the change.",
                  },
                },
                allOf: [
                  {
                    if: {
                      properties: {
                        type: { const: "iac-module" },
                      },
                    },
                    then: {
                      properties: {
                        component: { enum: iacModuleEnum },
                      },
                    },
                  },
                  {
                    if: {
                      properties: {
                        type: { const: "cli" },
                      },
                    },
                    then: {
                      properties: {
                        component: { enum: cliEnum },
                      },
                    },
                  },
                  {
                    if: {
                      properties: {
                        type: { const: "devshell" },
                      },
                    },
                    then: {
                      properties: {
                        component: { enum: devshellEnum },
                      },
                    },
                  },
                  {
                    if: {
                      properties: {
                        type: { const: "configuration" },
                      },
                    },
                    then: {
                      properties: {
                        component: { enum: configurationEnum },
                      },
                    },
                  },
                  {
                    if: {
                      properties: {
                        type: { const: "installer" },
                      },
                    },
                    then: {
                      properties: {
                        component: { enum: installerEnum },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Deriving iac-module enum from packages/infrastructure/...");
  const iacModuleEnum = deriveIacModuleEnum();
  console.log(`  Found ${iacModuleEnum.length} iac-module entries.`);

  console.log("Deriving cli enum from packages/cli/src/commands/...");
  const cliEnum = [...deriveCliEnum(), ...CLI_EXTRA_COMPONENTS].sort();
  console.log(`  Found ${cliEnum.length} cli entries.`);

  console.log(
    "Deriving devshell enum from packages/nix/ script directories..."
  );
  const devshellEnum = deriveDevshellEnum();
  console.log(`  Found ${devshellEnum.length} devshell entries.`);

  console.log("Building log schema...");
  const logSchema = buildLogSchema(
    iacModuleEnum,
    cliEnum,
    devshellEnum,
    CONFIGURATION_ENUM,
    INSTALLER_ENUM
  );

  console.log(`Writing log schema to ${LOG_SCHEMA_OUTPUT_PATH}...`);
  writeFileSync(
    LOG_SCHEMA_OUTPUT_PATH,
    JSON.stringify(logSchema, null, 2) + "\n"
  );

  console.log("Done. Schema file generated successfully.");
}

main();
