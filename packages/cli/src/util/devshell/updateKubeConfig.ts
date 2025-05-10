import { join } from "node:path"
import { z } from "zod";
import { getPanfactumConfig } from "@/commands/config/get/getPanfactumConfig";
import { CLIError } from "../error/error";
import { readYAMLFile } from "../yaml/readYAMLFile";
import { writeYAMLFile } from "../yaml/writeYAMLFile";
import type { PanfactumContext } from "@/util/context/context";

const KUBE_CONFIG_SCHEMA = z.object({
    apiVersion: z.literal("v1"),
    kind: z.literal("Config"),
    "current-context": z.string().optional(),
    preferences: z.object({}).passthrough().optional(),
    clusters: z.array(z.object({
        name: z.string(),
        cluster: z.object({
            "certificate-authority-data": z.string().optional(),
            server: z.string().optional()
        }).passthrough()
    }).passthrough()).default([]),
    users: z.array(z.object({
        name: z.string(),
        user: z.object({
            exec: z.object({
                apiVersion: z.string(),
                args: z.array(z.string()).optional(),
                command: z.string(),
                env: z.union([z.null(), z.array(z.object({ name: z.string(), value: z.string() }))]).default(null),
                interactiveMode: z.string().default("IfAvailable"),
                provideClusterInfo: z.boolean().default(false)
            }).passthrough()
        }).passthrough()
    }).passthrough()).default([]),
    contexts: z.array(z.object({
        name: z.string(),
        context: z.object({
            cluster: z.string(),
            user: z.string()
        }).passthrough()
    }).passthrough()).default([]),
}).passthrough()

export const CLUSTERS_FILE_SCHEMA = z.record(z.string(), z.object({
    url: z.string(),
    envDir: z.string(),
    regionDir: z.string(),
    caData: z.string()
}))


export async function updateKubeConfig(inputs: { context: PanfactumContext }) {
    const { context } = inputs;

    const { kube_dir: kubeDir } = context.repoVariables
    const kubeConfigFilePath = join(kubeDir, "config");
    const clustersFilePath = join(kubeDir, "clusters.yaml")



    const [clusterInfo, oldConfig] = await Promise.all([
        readYAMLFile({
            context,
            filePath: clustersFilePath,
            validationSchema: CLUSTERS_FILE_SCHEMA
        }),
        readYAMLFile({
            context,
            filePath: kubeConfigFilePath,
            validationSchema: KUBE_CONFIG_SCHEMA
        })
    ])

    // If the clusters file doesn't exist, then there is nothing to update in the .kube/config
    if (!clusterInfo) {
        return
    }

    const newClusters = Object.entries(clusterInfo).map(([name, { caData, url }]) => ({
        name,
        cluster: {
            "certificate-authority-data": caData,
            server: url
        }
    }))

    const newUsers = await Promise.all(Object.entries(clusterInfo).map(async ([name, { regionDir, envDir }]) => {
        const { aws_profile: profile, aws_region: region } = await getPanfactumConfig({
            context,
            directory: join(context.repoVariables.environments_dir, envDir, regionDir)
        })

        if (!profile) {
            throw new CLIError(`Could not set up kubeconfig because could not infer AWS profile for ${name} cluster at ${envDir}/${regionDir}.`)
        }

        if (!region) {
            throw new CLIError(`Could not set up kubeconfig because could not infer AWS region for ${name} cluster at ${envDir}/${regionDir}.`)
        }

        return {
            name,
            user: {
                exec: {
                    apiVersion: "client.authentication.k8s.io/v1beta1",
                    command: "pf-get-kube-token",
                    args: [
                        "--region", region,
                        "--cluster-name", name,
                        "--profile", profile
                    ],
                    env: [{
                        name: "AWS_PROFILE",
                        value: profile
                    }],
                    interactiveMode: "IfAvailable",
                    provideClusterInfo: false
                }
            }
        }

    }))

    const newContexts = Object.entries(clusterInfo).map(([name]) => ({
        name,
        context: {
            cluster: name,
            user: name
        }
    }))

    if (oldConfig) {

        const clusterNamesSet = new Set(Object.keys(clusterInfo))
        const mergedClusters = oldConfig
            .clusters.filter(({ name }) => !clusterNamesSet.has(name)).concat(newClusters)
        const mergedUsers = oldConfig
            .users.filter(({ name }) => !clusterNamesSet.has(name)).concat(newUsers)
        const mergedContexts = oldConfig
            .contexts.filter(({ name }) => !clusterNamesSet.has(name)).concat(newContexts)

        await writeYAMLFile({
            context,
            filePath: kubeConfigFilePath,
            values: {
                ...oldConfig,
                clusters: mergedClusters,
                users: mergedUsers,
                contexts: mergedContexts
            },
            overwrite: true
        })
    } else {
        await writeYAMLFile({
            context,
            filePath: kubeConfigFilePath,
            values: {
                apiVersion: "v1",
                kind: "Config",
                preferences: {},
                "current-context": newContexts.length > 0 ? newContexts[0]!.name : undefined,
                clusters: newClusters,
                users: newUsers,
                contexts: newContexts
            }
        })
    }
}