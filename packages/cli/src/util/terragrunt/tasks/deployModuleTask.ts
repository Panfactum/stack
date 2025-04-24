import { join } from "node:path";
import { type ListrTask } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import { applyColors } from "@/util/colors/applyColors";
import { CLIError } from "@/util/error/error";
import { createDirectory } from "@/util/fs/createDirectory";
import { fileContains } from "@/util/fs/fileContains";
import { fileExists } from "@/util/fs/fileExists";
import { writeFile } from "@/util/fs/writeFile";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { terragruntApply } from "../terragruntApply";
import { terragruntImport } from "../terragruntImport";
import { terragruntInit } from "../terragruntInit";
import type { PanfactumContext } from "@/context/context";

export function defineInputUpdate<T extends z.ZodType, C extends {}>(config: {
  schema: T;
  update: (oldInput: z.infer<T> | undefined, ctx: C) => z.infer<T>;
}) {
  return config;
}

export async function buildDeployModuleTask<T extends {}>(inputs: {
  context: PanfactumContext;
  env?: Record<string, string | undefined>;
  environment: string;
  region: string;
  module: string;
  initModule?: boolean; // should init be run
  hclIfMissing?: string; // contents of the HCL file to create if the module doesn't already exist
  taskTitle?: string;
  realModuleName?: string; // if the `module` string is different from the Panfactum module to actually deploy (e.g., `sops` => `aws_kms_encryption_key`)
  imports?: {
    [resourcePath: string]: {
      shouldImport?: (ctx: T) => Promise<boolean>;
      resourceId: string | ((ctx: T) => string);
    };
  };
  inputUpdates?: {
    [inputName: string]: ReturnType<typeof defineInputUpdate<z.ZodType, T>>;
  };
}): Promise<ListrTask<T>> {
  const {
    hclIfMissing,
    context,
    environment,
    region,
    module,
    realModuleName,
    imports = {},
    inputUpdates = {},
    initModule = true,
    taskTitle = "Deploy module",
  } = inputs;

  return {
    title: applyColors(`${taskTitle} ${module}`, {
      highlights: [{ phrase: module, style: "subtle" }],
    }),
    task: async (ctx, parentTask) => {
      const subtasks = parentTask.newListr([], { concurrent: false });

      //////////////////////////////////////////////////////////////
      // If the terragrunt.hcl is missing, then add it
      //////////////////////////////////////////////////////////////
      const moduleDir = join(
        context.repoVariables.environments_dir,
        environment,
        region,
        module
      );
      const moduleHCLPath = join(moduleDir, "terragrunt.hcl");
      if (!(await fileExists(moduleHCLPath))) {
        if (!hclIfMissing) {
          throw new CLIError(
            `No module exists at ${moduleHCLPath} and no fallback terragrunt.hcl was provided.`
          );
        }
        subtasks.add({
          title: "Create the terragrunt.hcl",
          task: async () => {
            await createDirectory(moduleDir);
            await writeFile({
              context,
              path: moduleHCLPath,
              contents: hclIfMissing,
            });
          },
        });
      }

      //////////////////////////////////////////////////////////////
      // If needed, update the module inputs via the module.yaml file
      //////////////////////////////////////////////////////////////
      const moduleYAMLPath = join(moduleDir, "module.yaml");
      if (Object.keys(inputUpdates).length > 0 || realModuleName) {
        subtasks.add({
          title: "Update module inputs",
          task: async (_, task) => {
            for (const input of Object.keys(inputUpdates)) {
              if (
                await fileContains({
                  filePath: moduleHCLPath,
                  context,
                  regex: new RegExp(`${input}\\s*=`),
                })
              ) {
                throw new CLIError(
                  `Cannot update input '${input}' as you are configuring it via 'terragrunt.hcl' input rather than using 'module.yaml'.`
                );
              }
            }

            if (await fileExists(moduleYAMLPath)) {
              const inputSchemas = Object.fromEntries(
                Object.entries(inputUpdates).map(([input, { schema }]) => [
                  input,
                  schema,
                ])
              );
              const originalModuleConfig = await readYAMLFile({
                filePath: moduleYAMLPath,
                context,
                validationSchema: z
                  .object({
                    extra_inputs: z
                      .object(inputSchemas)
                      .passthrough()
                      .optional()
                      .default({}),
                  })
                  .passthrough(),
              });
              const newModuleConfig = {
                module: realModuleName,
                ...originalModuleConfig,
                extra_inputs: {
                  ...originalModuleConfig?.extra_inputs,
                  ...Object.fromEntries(
                    Object.entries(inputUpdates).map(([input, { update }]) => [
                      input,
                      update(originalModuleConfig?.extra_inputs[input], ctx),
                    ])
                  ),
                },
              };
              await writeYAMLFile({
                context,
                path: moduleYAMLPath,
                contents: newModuleConfig,
                overwrite: true,
              });
            } else {
              await writeYAMLFile({
                context,
                path: moduleYAMLPath,
                contents: {
                  extra_inputs: Object.fromEntries(
                    Object.entries(inputUpdates).map(([input, { update }]) => {
                      return [input, update(undefined, ctx)];
                    })
                  ),
                  module: realModuleName,
                },
                overwrite: true,
              });
            }
            task.title = "Updated module inputs";
          },
        });
      }

      //////////////////////////////////////////////////////////////
      // If needed, init the module
      //////////////////////////////////////////////////////////////
      if (initModule) {
        subtasks.add({
          title: "Initialize module",
          task: async (_, task) => {
            task.title = "Initializing module";
            await terragruntInit({
              ...inputs,
              onLogLine: (line) => {
                task.output = applyColors(line, { style: "subtle" });
              },
            });
            task.title = "Initialized module";
          },
          rendererOptions: {
            outputBar: 5,
          },
        });
      }

      //////////////////////////////////////////////////////////////
      // If needed, import the resource before running apply
      //////////////////////////////////////////////////////////////
      subtasks.add(
        Object.entries(imports).map(
          ([resourcePath, { resourceId, shouldImport }]) => {
            const resolvedId =
              typeof resourceId === "string" ? resourceId : resourceId(ctx);
            return {
              title: applyColors(`Import ${resourcePath} ${resolvedId}`, {
                highlights: [{ phrase: resolvedId, style: "subtle" }],
              }),
              enabled: async (ctx) =>
                shouldImport ? await shouldImport(ctx) : true,
              task: async (_, task) => {
                task.title = applyColors(
                  `Importing ${resourcePath} ${resolvedId}`,
                  { highlights: [{ phrase: resolvedId, style: "subtle" }] }
                );
                await terragruntImport({
                  ...inputs,
                  resourcePath,
                  resourceId: resolvedId,
                  onLogLine: (line) => {
                    task.output = applyColors(line, { style: "subtle" });
                  },
                });
                task.title = applyColors(
                  `Imported ${resourcePath} ${resolvedId}`,
                  { highlights: [{ phrase: resolvedId, style: "subtle" }] }
                );
              },
              rendererOptions: {
                outputBar: 5,
              },
            };
          }
        )
      );

      //////////////////////////////////////////////////////////////
      // Finally, apply the module
      //////////////////////////////////////////////////////////////
      subtasks.add({
        title: "Apply module",
        task: async (_, task) => {
          task.title = "Applying - Planning changes";
          let deltas = 0;
          let deltaCounter = 0;
          let changeCounter = 0;
          let deleteCounter = 0;
          let createCounter = 0;
          await terragruntApply({
            ...inputs,
            onLogLine: (line) => {
              task.output = applyColors(line, { style: "subtle" });

              // When running apply, we want to show a progress indicator
              // To do that, we wait for the plan step to finish and collect the
              // count of resources to add, change, and destroy.
              // Once we have that count, we can watch the logs for "complete" messages
              // and then we can calculate a rough % complete indicator
              if (deltas === 0) {
                const planRegex =
                  /(\d+) to add, (\d+) to change, (\d+) to destroy/;
                const match = line.match(planRegex);
                if (match) {
                  const [_, toAdd, toChange, toDestroy] = match;
                  deltas = Number(toAdd) + Number(toChange) + Number(toDestroy);
                }
              } else {
                if (line.includes("Destruction complete")) {
                  deltaCounter++;
                  deleteCounter++;
                } else if (line.includes("Creation complete")) {
                  deltaCounter++;
                  createCounter++;
                } else if (line.includes("Change complete")) {
                  deltaCounter++;
                  changeCounter++;
                }
                const percentComplete = Math.floor(
                  (deltaCounter / deltas) * 100
                );
                task.title = applyColors(`Deploying ${percentComplete}%`, {
                  highlights: [
                    { phrase: `${percentComplete}%`, style: "subtle" },
                  ],
                });
              }
            },
          });
          task.title = `Applied module`;
          parentTask.title =
            applyColors(`${taskTitle} ${module}`, {
              highlights: [{ phrase: module, style: "subtle" }],
            }) +
            ` ${pc.green(createCounter)}${pc.gray("/")}${pc.blue(changeCounter)}${pc.gray("/")}${pc.red(deleteCounter)}`;
        },
        rendererOptions: {
          outputBar: 5,
        },
      });
      return subtasks;
    },
  };
}
