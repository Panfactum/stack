import { join } from "node:path"
import envRCPath from "@/files/direnv/envrc" with { type: "file" };
import { writeFile } from "@/util/fs/writeFile";
import { TERRAGRUNT_FILES } from "@/util/terragrunt/constants";
import { EXPECTED_GITIGNORE_CONTENTS } from "../constants";
import { upsertGitIgnore } from "../upsertGitIgnore";
import type { PanfactumContext } from "@/util/context/context";
import type { ListrTask } from "listr2";


export async function syncStandardFilesTask<T extends {}>(inputs: { context: PanfactumContext }): Promise<ListrTask<T>> {
    const { context } = inputs;

    return {
        title: "Sync standard files",
        task: async (_, parentTask) => {

            const subtasks = parentTask.newListr([], { concurrent: true })

            subtasks.add({
                title: "Update HCL files",
                task: async () => {
                    const environmentsDir = context.repoVariables.environments_dir;
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
                            path: join(context.repoVariables.environments_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.environments
                        }),
                        upsertGitIgnore({
                            path: join(context.repoVariables.aws_dir, ".aws"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.aws
                        }),
                        upsertGitIgnore({
                            path: join(context.repoVariables.ssh_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.ssh
                        }),
                        upsertGitIgnore({
                            path: join(context.repoVariables.kube_dir, ".gitignore"),
                            context,
                            lines: EXPECTED_GITIGNORE_CONTENTS.kube
                        }),
                        upsertGitIgnore({
                            path: join(context.repoVariables.repo_root, ".gitignore"),
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
                        filePath: join(context.repoVariables.repo_root, ".envrc"),
                        contents: await Bun.file(envRCPath).text(),
                        overwrite: true
                    })
                }
            })

            return subtasks;
        }
    }
}