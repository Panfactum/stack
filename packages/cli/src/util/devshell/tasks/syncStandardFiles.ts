import { join } from "node:path"
import envRCPath from "@/files/direnv/envrc" with { type: "file" };
import { writeFile } from "@/util/fs/writeFile";
import { TERRAGRUNT_FILES } from "@/util/terragrunt/constants";
import { EXPECTED_GITIGNORE_CONTENTS } from "../constants";
import { upsertGitIgnore } from "../upsertGitIgnore";
import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask } from "listr2";

/**
 * Interface for syncStandardFilesTask function input
 */
interface ISyncStandardFilesTaskInput {
    /** Panfactum context for logging and configuration */
    context: PanfactumContext;
}

export async function syncStandardFilesTask<T extends {}>(inputs: ISyncStandardFilesTaskInput): Promise<ListrTask<T>> {
    const { context } = inputs;

    return {
        title: "Sync standard files",
        task: async (_, parentTask) => {

            const subtasks = parentTask.newListr([], { concurrent: true })

            subtasks.add({
                title: "Update HCL files",
                task: async () => {
                    const environmentsDir = context.devshellConfig.environments_dir;
                    await Promise.all(TERRAGRUNT_FILES.map(async ({ path, contentPath }) => {
                        const filePath = join(environmentsDir, path);
                        await writeFile({ context, filePath: filePath, contents: await Bun.file(contentPath).text(), overwrite: true })
                    }))
                }
            })

            subtasks.add({
                title: "Update .gitignore files",
                task: async () => {
                    await Promise.all([
                        upsertGitIgnore({
                            path: join(context.devshellConfig.environments_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.environments
                        }),
                        upsertGitIgnore({
                            path: join(context.devshellConfig.aws_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.aws
                        }),
                        upsertGitIgnore({
                            path: join(context.devshellConfig.ssh_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.ssh
                        }),
                        upsertGitIgnore({
                            path: join(context.devshellConfig.kube_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.kube
                        }),
                        upsertGitIgnore({
                            path: join(context.devshellConfig.repo_root, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.root
                        })
                    ])
                }
            })

            subtasks.add({
                title: "Update .envrc",
                task: async () => {
                    await writeFile({
                        context,
                        filePath: join(context.devshellConfig.repo_root, ".envrc"),
                        contents: await Bun.file(envRCPath).text(),
                        overwrite: true
                    })
                }
            })

            return subtasks;
        }
    }
}