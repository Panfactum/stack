import { join } from "node:path";
import { type ListrTask } from "listr2";
import pc from "picocolors";
import { z } from "zod";
import { CLIError } from "@/util/error/error";
import { createDirectory } from "@/util/fs/createDirectory";
import { fileContains } from "@/util/fs/fileContains";
import { fileExists } from "@/util/fs/fileExists";
import { writeFile } from "@/util/fs/writeFile";
import { getModuleStatus } from "@/util/terragrunt/getModuleStatus";
import { readYAMLFile } from "@/util/yaml/readYAMLFile";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { terragruntApply } from "../terragruntApply";
import { terragruntImport } from "../terragruntImport";
import { terragruntInit } from "../terragruntInit";
import type { PanfactumContext } from "@/util/context/context";

/**
 * Helper for definining input updates that are properly typed
 * DO NOT CHANGE!!!!!!!
 */
export function defineInputUpdate<T extends z.ZodType, C extends {}>(config: {
    /** Zod schema for input validation */
    schema: T;
    /** Function to update old input with new context */
    update: (oldInput: z.infer<T> | undefined, ctx: C) => z.infer<T>;
}) {
    return config;
}

type InputUpdates<T extends {}> = {
    [inputName: string]: ReturnType<typeof defineInputUpdate<z.ZodType, T>>;
}


/**
 * Interface for buildDeployModuleTask function inputs
 */
interface IBuildDeployModuleTaskInput<T extends {}> {
    /** Panfactum context for operations */
    context: PanfactumContext;
    /** Environment variables for the deployment */
    env?: Record<string, string | undefined>;
    /** Environment name */
    environment: string;
    /** Region name */
    region: string;
    /** Module name to deploy */
    module: string;
    /** Force module initialization even if it appears unnecessary */
    forceInitModule?: boolean;
    /** HCL file contents to create if module doesn't exist */
    hclIfMissing?: string;
    /** Custom task title */
    taskTitle?: string;
    /** Real module name if different from module parameter */
    realModuleName?: string;
    /** Resource imports configuration */
    imports?: {
        [resourcePath: string]: {
            resourceId: string | undefined | ((ctx: T) => Promise<string | undefined>);
        };
    };
    /** Input updates to apply during deployment */
    inputUpdates?: InputUpdates<T>;
    /** Input updates to apply after deployment */
    postDeployInputUpdates?: InputUpdates<T>;
    /** Skip deployment if already applied */
    skipIfAlreadyApplied?: boolean;
    /** Warning message about deployment time */
    etaWarningMessage?: string;
}

export async function buildDeployModuleTask<T extends {}>(input: IBuildDeployModuleTaskInput<T>): Promise<ListrTask<T>> {
    const {
        hclIfMissing,
        context,
        environment,
        region,
        module,
        forceInitModule,
        taskTitle,
        realModuleName,
        imports,
        inputUpdates,
        postDeployInputUpdates,
        skipIfAlreadyApplied,
        etaWarningMessage,
        env
    } = input;

    const moduleDir = join(
        context.devshellConfig.environments_dir,
        environment,
        region,
        module
    );
    const moduleHCLPath = join(moduleDir, "terragrunt.hcl");
    const moduleYAMLPath = join(moduleDir, "module.yaml");

    const status = await getModuleStatus({ context, environment, region, module })

    // Base inputs object for terragrunt function calls
    const inputs = {
        context,
        environment,
        region,
        module,
        env,
        etaWarningMessage
    };

    const updateModuleYAML = async (updates: InputUpdates<T>, ctx: T) => {
        for (const input of Object.keys(updates)) {
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

        if (await fileExists({ filePath: moduleYAMLPath })) {
            const inputSchemas = Object.fromEntries(
                Object.entries(updates).map(([input, { schema }]) => [
                    input,
                    schema.optional(),
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
                        Object.entries(updates).map(([input, { update }]) => [
                            input,
                            update(originalModuleConfig?.extra_inputs[input], ctx),
                        ])
                    ),
                },
            };
            await writeYAMLFile({
                context,
                filePath: moduleYAMLPath,
                values: newModuleConfig,
                overwrite: true,
            });
        } else {
            await writeYAMLFile({
                context,
                filePath: moduleYAMLPath,
                values: {
                    extra_inputs: Object.fromEntries(
                        Object.entries(updates).map(([input, { update }]) => {
                            return [input, update(undefined, ctx)];
                        })
                    ),
                    module: realModuleName,
                },
                overwrite: true,
            });
        }
    }

    return {
        title: context.logger.applyColors(`${taskTitle} ${module}`, {
            lowlights: [module],
        }),
        skip: async () => {
            if (skipIfAlreadyApplied) {
                const pfData = await getModuleStatus({ environment, region, module, context });
                return pfData.deploy_status === "success";
            }

            return false;
        },
        task: async (ctx, parentTask) => {
            const subtasks = parentTask.newListr([], { concurrent: false });

            //////////////////////////////////////////////////////////////
            // If the terragrunt.hcl is missing, then add it
            //////////////////////////////////////////////////////////////

            if (!(await fileExists({ filePath: moduleHCLPath }))) {
                if (!hclIfMissing) {
                    throw new CLIError(
                        `No module exists at ${moduleHCLPath} and no fallback terragrunt.hcl was provided.`
                    );
                }
                subtasks.add({
                    title: "Create the terragrunt.hcl",
                    task: async () => {
                        await createDirectory({ dirPath: moduleDir });
                        await writeFile({
                            context,
                            filePath: moduleHCLPath,
                            contents: hclIfMissing,
                        });
                    },
                });
            }

            //////////////////////////////////////////////////////////////
            // If needed, update the module inputs via the module.yaml file
            //////////////////////////////////////////////////////////////
            if ((inputUpdates && Object.keys(inputUpdates).length > 0) || realModuleName) {
                subtasks.add({
                    title: "Update module inputs",
                    task: async (_, task) => {
                        await updateModuleYAML(inputUpdates || {}, ctx)
                        task.title = "Updated module inputs";
                    },
                });
            }

            //////////////////////////////////////////////////////////////
            // If needed, init the module
            //////////////////////////////////////////////////////////////
            if ((status.init_status !== "success" && status.init_status !== "running") || forceInitModule) {
                subtasks.add({
                    title: "Initialize module",
                    task: async (_, task) => {
                        task.title = "Initializing module";
                        await terragruntInit({
                            ...inputs,
                            onLogLine: (line) => {
                                task.output = context.logger.applyColors(line, { style: "subtle", highlighterDisabled: true });
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
                Object.entries(imports || {}).map(
                    ([resourcePath, { resourceId }]) => {
                        return {
                            title: context.logger.applyColors(`Import ${resourcePath}`),
                            enabled: async (ctx) => typeof resourceId === "string" || (resourceId !== undefined && await resourceId(ctx) !== undefined),
                            task: async (ctx, task) => {
                                const resolvedId =
                                    typeof resourceId === "string" || resourceId === undefined ? resourceId : await resourceId(ctx);

                                if (!resolvedId) {
                                    task.skip(context.logger.applyColors(`Import ${resourcePath} Skipped`, { lowlights: ["Skipped"] }))
                                    return;
                                }

                                task.title = context.logger.applyColors(
                                    `Importing ${resourcePath} ${resolvedId}`,
                                    { lowlights: [resolvedId] }
                                );
                                await terragruntImport({
                                    ...inputs,
                                    resourcePath,
                                    resourceId: resolvedId,
                                    onLogLine: (line) => {
                                        task.output = context.logger.applyColors(line, { style: "subtle", highlighterDisabled: true });
                                    },
                                });
                                task.title = context.logger.applyColors(
                                    `Imported ${resourcePath} ${resolvedId}`,
                                    { lowlights: [resolvedId] }
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
                    // todo: accept eta minutes vs free form string
                    // todo: this should be persistent, ensure it does not disappear until completion
                    task.title = `Applying - Planning changes${etaWarningMessage ? ` (${etaWarningMessage})` : ""}`;
                    let deltas = 0;
                    let deltaCounter = 0;
                    let changeCounter = 0;
                    let deleteCounter = 0;
                    let createCounter = 0;
                    await terragruntApply({
                        ...inputs,
                        onLogLine: (line) => {
                            task.output = context.logger.applyColors(line, { style: "subtle", highlighterDisabled: true });

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
                                task.title = context.logger.applyColors(`Deploying ${percentComplete}%`, {
                                    lowlights: [`${percentComplete}%`]
                                });
                            }
                        },
                    });
                    task.title = `Applied module`;
                    parentTask.title =
                        context.logger.applyColors(`${taskTitle} ${module}`, {
                            lowlights: [module],
                        }) +
                        ` ${pc.green(createCounter)}${pc.gray("/")}${pc.blue(changeCounter)}${pc.gray("/")}${pc.red(deleteCounter)}`;
                },
                rendererOptions: {
                    outputBar: 5,
                },
            });


            //////////////////////////////////////////////////////////////
            // If needed, update the module inputs again
            //////////////////////////////////////////////////////////////
            if (postDeployInputUpdates && Object.keys(postDeployInputUpdates).length > 0) {
                subtasks.add({
                    title: "Post-deploy input updates",
                    task: async () => {
                        await updateModuleYAML(postDeployInputUpdates || {}, ctx)
                    },
                });
            }

            return subtasks;
        },
    };
}
