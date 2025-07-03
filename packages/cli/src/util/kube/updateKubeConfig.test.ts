// Unit tests for the updateKubeConfig utility
// Tests Kubernetes configuration file generation and updates

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, mock, beforeEach, afterEach, spyOn } from "bun:test";
import * as getPanfactumConfigModule from "@/util/config/getPanfactumConfig";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import * as readYAMLFileModule from "@/util/yaml/readYAMLFile";
import * as writeYAMLFileModule from "@/util/yaml/writeYAMLFile";
import { CLUSTERS_FILE_SCHEMA, type KubeConfig, type ClustersConfig } from "./schemas";
import { updateKubeConfig } from "./updateKubeConfig";
import type { PanfactumContext } from "@/util/context/context";

// Test constants
const TEST_CLUSTER = "test-cluster";
const TEST_REGION = "us-east-1";
const TEST_PROFILE = "test-profile";
const PRODUCTION_ENV = "production";
const EXISTING_CLUSTER = "existing-cluster";

// Helper to create a mock context
const createMockContext = (kubeDir: string, environmentsDir: string): PanfactumContext => ({
    logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {})
    },
    devshellConfig: {
        kube_dir: kubeDir,
        environments_dir: environmentsDir,
        repo_root: "/test/repo",
        repo_name: "test-repo",
        tf_modules_dir: "/test/modules"
    }
} as unknown as PanfactumContext);

// Helper to create clusters.yaml content
const createClustersConfig = (clusters: ClustersConfig): ClustersConfig => {
    return clusters;
};

// Helper to create kube config content
const createKubeConfig = (options: {
    currentContext?: string;
    clusters?: Array<{ name: string; cluster: { server: string; "certificate-authority-data": string; [key: string]: unknown } }>;
    users?: Array<{ name: string; user: Record<string, unknown> }>;
    contexts?: Array<{ name: string; context: { cluster: string; user: string; [key: string]: unknown } }>;
}) => ({
    apiVersion: "v1",
    kind: "Config",
    "current-context": options.currentContext,
    preferences: {},
    clusters: options.clusters || [],
    users: options.users || [],
    contexts: options.contexts || []
});

describe("updateKubeConfig", () => {
    let testDir: string;
    let kubeDir: string;
    let environmentsDir: string;
    let getPanfactumConfigMock: ReturnType<typeof spyOn<typeof getPanfactumConfigModule, "getPanfactumConfig">>;
    let readYAMLFileMock: ReturnType<typeof spyOn<typeof readYAMLFileModule, "readYAMLFile">>;
    let writeYAMLFileMock: ReturnType<typeof spyOn<typeof writeYAMLFileModule, "writeYAMLFile">>;

    beforeEach(async () => {
        const result = await createTestDir({ functionName: "updateKubeConfig" });
        testDir = result.path;
        kubeDir = join(testDir, "kube");
        environmentsDir = join(testDir, "environments");

        await mkdir(kubeDir, { recursive: true });
        await mkdir(environmentsDir, { recursive: true });

        // Create spies for module functions
        getPanfactumConfigMock = spyOn(getPanfactumConfigModule, "getPanfactumConfig");
        getPanfactumConfigMock.mockResolvedValue({
            aws_profile: TEST_PROFILE,
            aws_region: TEST_REGION
        });

        readYAMLFileMock = spyOn(readYAMLFileModule, "readYAMLFile");
        readYAMLFileMock.mockResolvedValue(null);

        writeYAMLFileMock = spyOn(writeYAMLFileModule, "writeYAMLFile");
        writeYAMLFileMock.mockResolvedValue(undefined);
    });

    afterEach(async () => {
        // Reset all mocks after each test
        getPanfactumConfigMock.mockRestore();
        readYAMLFileMock.mockRestore();
        writeYAMLFileMock.mockRestore();
        
        // Clean up test directory
        if (testDir) {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    test("returns early when clusters file does not exist", async () => {
        // Mock clusters file as not existing
        readYAMLFileMock
            .mockResolvedValueOnce(null) // clusters file
            .mockResolvedValueOnce(null); // kube config file

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        expect(readYAMLFileMock).toHaveBeenCalledTimes(2);
        expect(writeYAMLFileMock).not.toHaveBeenCalled();
        expect(getPanfactumConfigMock).not.toHaveBeenCalled();
    });

    test("creates new kube config when no existing config exists", async () => {
        const clustersConfig = createClustersConfig({
            [TEST_CLUSTER]: {
                url: "https://test-cluster.example.com",
                envDir: PRODUCTION_ENV,
                regionDir: TEST_REGION,
                caData: "dGVzdC1jYS1kYXRh" // base64 encoded "test-ca-data"
            }
        });

        // Mock clusters file exists, kube config doesn't
        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: TEST_PROFILE,
            aws_region: TEST_REGION
        });

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        expect(getPanfactumConfigMock).toHaveBeenCalledWith({
            context,
            directory: join(environmentsDir, PRODUCTION_ENV, TEST_REGION)
        });

        expect(writeYAMLFileMock).toHaveBeenCalledWith({
            context,
            filePath: join(kubeDir, "config"),
            values: {
                apiVersion: "v1",
                kind: "Config",
                preferences: {},
                "current-context": TEST_CLUSTER,
                clusters: [{
                    name: TEST_CLUSTER,
                    cluster: {
                        "certificate-authority-data": "dGVzdC1jYS1kYXRh",
                        server: "https://test-cluster.example.com"
                    }
                }],
                users: [{
                    name: TEST_CLUSTER,
                    user: {
                        exec: {
                            apiVersion: "client.authentication.k8s.io/v1beta1",
                            command: "pf",
                            args: [
                                "kube", "get-token",
                                "--region", TEST_REGION,
                                "--cluster-name", TEST_CLUSTER,
                                "--profile", TEST_PROFILE
                            ],
                            env: [{
                                name: "AWS_PROFILE",
                                value: TEST_PROFILE
                            }],
                            interactiveMode: "IfAvailable",
                            provideClusterInfo: false
                        }
                    }
                }],
                contexts: [{
                    name: TEST_CLUSTER,
                    context: {
                        cluster: TEST_CLUSTER,
                        user: TEST_CLUSTER
                    }
                }]
            }
        });
    });

    test("merges new clusters with existing kube config", async () => {
        const clustersConfig = createClustersConfig({
            "new-cluster": {
                url: "https://new-cluster.example.com",
                envDir: "staging",
                regionDir: "us-west-2",
                caData: "bmV3LWNhLWRhdGE=" // base64 encoded "new-ca-data"
            }
        });

        const existingConfig = createKubeConfig({
            currentContext: EXISTING_CLUSTER,
            clusters: [{
                name: EXISTING_CLUSTER,
                cluster: {
                    server: "https://existing-cluster.example.com",
                    "certificate-authority-data": "ZXhpc3RpbmctY2E="
                }
            }],
            users: [{
                name: EXISTING_CLUSTER,
                user: { token: "existing-token" }
            }],
            contexts: [{
                name: EXISTING_CLUSTER,
                context: {
                    cluster: EXISTING_CLUSTER,
                    user: EXISTING_CLUSTER
                }
            }]
        });

        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(existingConfig); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: "staging-profile",
            aws_region: "us-west-2"
        });

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        const writeCall = writeYAMLFileMock.mock.calls[0] as [{ context: PanfactumContext; filePath: string; values: KubeConfig; overwrite?: boolean }] | undefined;
        const writtenConfig = writeCall?.[0]?.values;

        expect(writtenConfig).toMatchInlineSnapshot(`
            {
              "apiVersion": "v1",
              "clusters": [
                {
                  "cluster": {
                    "certificate-authority-data": "ZXhpc3RpbmctY2E=",
                    "server": "https://existing-cluster.example.com",
                  },
                  "name": "existing-cluster",
                },
                {
                  "cluster": {
                    "certificate-authority-data": "bmV3LWNhLWRhdGE=",
                    "server": "https://new-cluster.example.com",
                  },
                  "name": "new-cluster",
                },
              ],
              "contexts": [
                {
                  "context": {
                    "cluster": "existing-cluster",
                    "user": "existing-cluster",
                  },
                  "name": "existing-cluster",
                },
                {
                  "context": {
                    "cluster": "new-cluster",
                    "user": "new-cluster",
                  },
                  "name": "new-cluster",
                },
              ],
              "current-context": "existing-cluster",
              "kind": "Config",
              "preferences": {},
              "users": [
                {
                  "name": "existing-cluster",
                  "user": {
                    "token": "existing-token",
                  },
                },
                {
                  "name": "new-cluster",
                  "user": {
                    "exec": {
                      "apiVersion": "client.authentication.k8s.io/v1beta1",
                      "args": [
                        "kube",
                        "get-token",
                        "--region",
                        "us-west-2",
                        "--cluster-name",
                        "new-cluster",
                        "--profile",
                        "staging-profile",
                      ],
                      "command": "pf",
                      "env": [
                        {
                          "name": "AWS_PROFILE",
                          "value": "staging-profile",
                        },
                      ],
                      "interactiveMode": "IfAvailable",
                      "provideClusterInfo": false,
                    },
                  },
                },
              ],
            }
        `);
    });

    test("replaces existing cluster configuration when cluster name matches", async () => {
        const clustersConfig = createClustersConfig({
            [EXISTING_CLUSTER]: {
                url: "https://updated-cluster.example.com",
                envDir: PRODUCTION_ENV,
                regionDir: TEST_REGION,
                caData: "dXBkYXRlZC1jYS1kYXRh" // base64 encoded "updated-ca-data"
            }
        });

        const existingConfig = createKubeConfig({
            currentContext: EXISTING_CLUSTER,
            clusters: [{
                name: EXISTING_CLUSTER,
                cluster: {
                    server: "https://old-cluster.example.com",
                    "certificate-authority-data": "b2xkLWNhLWRhdGE="
                }
            }],
            users: [{
                name: EXISTING_CLUSTER,
                user: { token: "old-token" }
            }],
            contexts: [{
                name: EXISTING_CLUSTER,
                context: {
                    cluster: EXISTING_CLUSTER,
                    user: EXISTING_CLUSTER
                }
            }]
        });

        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(existingConfig); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: TEST_PROFILE,
            aws_region: TEST_REGION
        });

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        const writeCall = writeYAMLFileMock.mock.calls[0] as [{ context: PanfactumContext; filePath: string; values: KubeConfig; overwrite?: boolean }] | undefined;
        const writtenConfig = writeCall?.[0]?.values;

        // Should only have one cluster (the updated one)
        expect(writtenConfig?.clusters).toHaveLength(1);
        expect(writtenConfig?.clusters[0]).toMatchInlineSnapshot(`
            {
              "cluster": {
                "certificate-authority-data": "dXBkYXRlZC1jYS1kYXRh",
                "server": "https://updated-cluster.example.com",
              },
              "name": "existing-cluster",
            }
        `);

        // Should have the new exec config, not the old token
        expect(writtenConfig?.users[0]?.user.exec).toBeDefined();
        expect(writtenConfig?.users[0]?.user["token"]).toBeUndefined();
    });

    test("throws CLIError when AWS profile is missing", async () => {
        const clustersConfig = createClustersConfig({
            [TEST_CLUSTER]: {
                url: "https://test-cluster.example.com",
                envDir: PRODUCTION_ENV,
                regionDir: TEST_REGION,
                caData: "dGVzdC1jYS1kYXRh"
            }
        });

        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: undefined, // Missing profile
            aws_region: TEST_REGION
        });

        const context = createMockContext(kubeDir, environmentsDir);

        await expect(updateKubeConfig({ context })).rejects.toThrow(CLIError);
        
        // Reset mocks for second call
        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file
            
        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: undefined, // Missing profile
            aws_region: TEST_REGION
        });
        
        await expect(updateKubeConfig({ context })).rejects.toThrow(
            `Could not set up kubeconfig because could not infer AWS profile for ${TEST_CLUSTER} cluster at ${PRODUCTION_ENV}/${TEST_REGION}.`
        );
    });

    test("throws CLIError when AWS region is missing", async () => {
        const clustersConfig = createClustersConfig({
            [TEST_CLUSTER]: {
                url: "https://test-cluster.example.com",
                envDir: PRODUCTION_ENV,
                regionDir: TEST_REGION,
                caData: "dGVzdC1jYS1kYXRh"
            }
        });

        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: TEST_PROFILE,
            aws_region: undefined // Missing region
        });

        const context = createMockContext(kubeDir, environmentsDir);

        await expect(updateKubeConfig({ context })).rejects.toThrow(CLIError);
        
        // Reset mocks for second call
        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file
            
        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: TEST_PROFILE,
            aws_region: undefined // Missing region
        });
        
        await expect(updateKubeConfig({ context })).rejects.toThrow(
            `Could not set up kubeconfig because could not infer AWS region for ${TEST_CLUSTER} cluster at ${PRODUCTION_ENV}/${TEST_REGION}.`
        );
    });

    test("sets correct file paths based on context", async () => {
        const clustersConfig = createClustersConfig({
            [TEST_CLUSTER]: {
                url: "https://test-cluster.example.com",
                envDir: PRODUCTION_ENV,
                regionDir: TEST_REGION,
                caData: "dGVzdC1jYS1kYXRh"
            }
        });

        readYAMLFileMock
            .mockResolvedValueOnce(clustersConfig) // clusters file
            .mockResolvedValueOnce(null); // kube config file

        getPanfactumConfigMock.mockResolvedValueOnce({
            aws_profile: TEST_PROFILE,
            aws_region: TEST_REGION
        });

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        // Verify correct file paths were used
        expect(readYAMLFileMock).toHaveBeenNthCalledWith(1, {
            context,
            filePath: join(kubeDir, "clusters.yaml"),
            validationSchema: CLUSTERS_FILE_SCHEMA
        });

        expect(readYAMLFileMock).toHaveBeenNthCalledWith(2, {
            context,
            filePath: join(kubeDir, "config"),
            validationSchema: expect.any(Object)
        });

        expect(writeYAMLFileMock).toHaveBeenCalledWith({
            context,
            filePath: join(kubeDir, "config"),
            values: expect.any(Object)
        });
    });

    test("handles empty clusters.yaml correctly", async () => {
        const emptyClustersConfig = {};

        readYAMLFileMock
            .mockResolvedValueOnce(emptyClustersConfig) // empty clusters file
            .mockResolvedValueOnce(null); // kube config file

        const context = createMockContext(kubeDir, environmentsDir);
        await updateKubeConfig({ context });

        expect(writeYAMLFileMock).toHaveBeenCalledWith({
            context,
            filePath: join(kubeDir, "config"),
            values: {
                apiVersion: "v1",
                kind: "Config",
                preferences: {},
                "current-context": undefined, // No clusters, so no current context
                clusters: [],
                users: [],
                contexts: []
            }
        });
    });

    afterEach(async () => {
        if (testDir) {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});