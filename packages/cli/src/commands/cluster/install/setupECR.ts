import path from "node:path";
import { input, password } from "@inquirer/prompts";
import pc from "picocolors"
import { z } from "zod";
import ecrPullThroughCacheTemplate from "@/templates/aws_ecr_pull_through_cache_terragrunt.hcl" with { type: "file" };
import { upsertConfigValues } from "@/util/config/upsertConfigValues";
import { fileExists } from "@/util/fs/fileExists";
import { sopsDecrypt } from "@/util/sops/sopsDecrypt";
import { sopsUpsert } from "@/util/sops/sopsUpsert";
import { DOCKERHUB_USERNAME, GITHUB_USERNAME } from "./checkpointer";
import { deployModule } from "./deployModule";
import type { InstallClusterStepOptions } from "./common";

export async function setupECR(options: InstallClusterStepOptions) {

    const { clusterPath, stepNum, checkpointer, context } = options

    const moduleName = "aws_ecr_pull_through_cache"
    const modulePath = path.join(clusterPath, moduleName)

    /***************************************************
     * Get the user-provided config for ECR
     ***************************************************/
    const secretsPath = path.join(modulePath, "secrets.yaml")

    let ghPAT, dhPAT;

    if (await fileExists(secretsPath)) {
        ({ github_access_token: ghPAT, docker_hub_access_token: dhPAT } = await sopsDecrypt({
            filePath: secretsPath,
            context,
            validationSchema: z.object({
                github_access_token: z.string().optional(),
                docker_hub_access_token: z.string().optional()
            })
        }))
    }


    let [dhUsername, ghUsername] = await Promise.all([
        checkpointer.getSavedInput("dockerHubUsername"),
        checkpointer.getSavedInput("githubUsername")
    ])

    if (!dhUsername) {
        dhUsername = await input({
            message: pc.magenta("Enter your Docker Hub username:"),
            required: true,
            validate: (value) => {
                const { error } = DOCKERHUB_USERNAME.safeParse(value)
                if (error) {
                    return error.issues[0]?.message ?? "Invalid username"
                } else {
                    return true
                }
            }
        })
        checkpointer.updateSavedInput('dockerHubUsername', dhUsername)
    }

    if (!dhPAT) {
        dhPAT = await password({
            message: pc.magenta(
                `Enter your Docker Hub Access Token with 'Public Repo Read-only' permissions\n` +
                `For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#docker-hub-credentials\n` +
                `${pc.red("This will be encrypted and stored securely")}:`
            ),
            mask: true,
            validate: async (value) => {
                try {
                    const response = await globalThis.fetch("https://hub.docker.com/v2/repositories/library/nginx/tags", {
                        headers: {
                            Authorization: `Bearer ${value}`
                        }
                    })
                    if (response.status !== 200) {
                        return "This does not appear to be a valid Docker Hub Access Token or the permissions are not correct";
                    }
                    return true;
                } catch {
                    return "Error validating Docker Hub Access Token, please try again.";
                }
            },
        });
        await sopsUpsert({ values: { docker_hub_access_token: dhPAT }, context, filePath: secretsPath })
    }

    if (!ghUsername) {
        ghUsername = await input({
            message: pc.magenta("Enter your GitHub username:"),
            required: true,
            validate: (value) => {
                const { error } = GITHUB_USERNAME.safeParse(value)
                if (error) {
                    return error.issues[0]?.message ?? "Invalid username"
                } else {
                    return true
                }
            }
        });
        checkpointer.updateSavedInput("githubUsername", ghUsername)
    }

    if (!ghPAT) {
        ghPAT = await password({
            message: pc.magenta(
                `Enter your classic GitHub Personal Access Token with 'read:packages' scope\n` +
                `For more details on how to create one, see our documentation: https://panfactum.com/docs/edge/guides/bootstrapping/kubernetes-cluster#github-credentials\n` +
                `${pc.red("This will be encrypted and stored securely")}:`
            ),
            mask: true,
            validate: async (value) => {
                try {
                    const response = await globalThis.fetch("https://api.github.com/user/packages?package_type=container", {
                        headers: {
                            Authorization: `Bearer ${value}`
                        }
                    })
                    if (response.status !== 200) {
                        return "This does not appear to be a valid GitHub Personal Access Token or the permissions are not correct";
                    }
                    return true;
                } catch {
                    return "Error validating GitHub Personal Access Token, please try again.";
                }
            },
        });
        await sopsUpsert({ values: { github_access_token: ghPAT }, context, filePath: secretsPath })
    }

    /***************************************************
     * Deploy the ECR Module
     ***************************************************/
    await deployModule({
        ...options,
        stepId: "ecrDeployment",
        stepName: "ECR Deployment",
        moduleDirectory: moduleName,
        terraguntContents: ecrPullThroughCacheTemplate,
        stepNum: stepNum,
        subStepNum: 1,
        hclUpdates: {
            "inputs.docker_hub_username": dhUsername,
            "inputs.github_username": ghUsername
        }
    })

    /***************************************************
     * Update the region.yaml
     ***************************************************/
    await upsertConfigValues({
        filePath: path.join(clusterPath, "region.yaml"),
        values: {
            extra_inputs: {
                pull_through_cache_enabled: true
            }
        }
    })
}