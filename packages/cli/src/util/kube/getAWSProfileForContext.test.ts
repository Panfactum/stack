// Tests for getAWSProfileForContext function
// Validates AWS profile extraction from Kubernetes configurations

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { CLIError } from "@/util/error/error";
import { createTestDir } from "@/util/test/createTestDir";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { getAWSProfileForContext } from "./getAWSProfileForContext";
import type { KubeConfig } from "./schemas";
import type { PanfactumContext } from "@/util/context/context";

// Test constants
const TEST_CONTEXT = "test-context";
const TEST_CLUSTER = "test-cluster";
const TEST_USER = "test-user";
const TEST_PROFILE = "test-profile";
const API_VERSION = "client.authentication.k8s.io/v1beta1";
const AWS_COMMAND = "aws";
const CLUSTER_NAME_ARG = "--cluster-name";
const EKS_GET_TOKEN_ARGS = ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER];

/**
 * Creates a mock Panfactum context for testing
 */
function createMockContext(kubeDir: string): PanfactumContext {
  return {
    devshellConfig: {
      kube_dir: kubeDir
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  } as unknown as PanfactumContext;
}

/**
 * Creates a basic kubeconfig structure for testing
 */
function createBasicKubeConfig(overrides?: Partial<KubeConfig>): KubeConfig {
  return {
    apiVersion: "v1",
    kind: "Config",
    "current-context": TEST_CONTEXT,
    clusters: [{
      name: TEST_CLUSTER,
      cluster: {
        server: "https://k8s.example.com",
        "certificate-authority-data": "dummy-ca-data"
      }
    }],
    users: [{
      name: TEST_USER,
      user: {
        exec: {
          apiVersion: API_VERSION,
          command: AWS_COMMAND,
          args: EKS_GET_TOKEN_ARGS,
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
      name: TEST_CONTEXT,
      context: {
        cluster: TEST_CLUSTER,
        user: TEST_USER
      }
    }],
    ...overrides
  };
}

describe("getAWSProfileForContext", () => {
  let testDir: string;
  let kubeDir: string;
  let context: PanfactumContext;

  beforeEach(async () => {
    const result = await createTestDir({ functionName: "getAWSProfileForContext" });
    testDir = result.path;
    kubeDir = join(testDir, ".kube");
    context = createMockContext(kubeDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("AWS_PROFILE environment variable", () => {
    test("extracts AWS profile from environment variable", async () => {
      const kubeConfig = createBasicKubeConfig();
      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe(TEST_PROFILE);
    });

    test("handles missing environment array gracefully", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile", "profile-from-args"],
              env: null,
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });
      
      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("profile-from-args");
    });
  });

  describe("--profile argument formats", () => {
    test("extracts AWS profile from --profile argument (separate)", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile", "profile-from-args"],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("profile-from-args");
    });

    test("extracts AWS profile from --profile=value format", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile=profile-with-equals"],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("profile-with-equals");
    });

    test("prefers environment variable over --profile argument", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile", "profile-from-args"],
              env: [{
                name: "AWS_PROFILE",
                value: "profile-from-env"
              }],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("profile-from-env");
    });

    test("handles --profile as last argument", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile"],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      await expect(getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      })).rejects.toThrow(CLIError);
    });
  });

  describe("error cases", () => {
    test("throws when kubeconfig file is missing", async () => {
      await expect(getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      })).rejects.toThrow(CLIError);
    });

    test("throws when context is not found", async () => {
      const kubeConfig = createBasicKubeConfig();
      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      await expect(getAWSProfileForContext({
        context,
        kubeContext: "non-existent-context"
      })).rejects.toThrow("Context 'non-existent-context' not found in kube config");
    });

    test("throws when user is not found", async () => {
      const kubeConfig = createBasicKubeConfig({
        contexts: [{
          name: TEST_CONTEXT,
          context: {
            cluster: TEST_CLUSTER,
            user: "non-existent-user"
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      await expect(getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      })).rejects.toThrow("User 'non-existent-user' not found in kube config");
    });

    test("throws when no AWS profile is found", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      await expect(getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      })).rejects.toThrow("No AWS profile found in exec configuration");
    });

    test("handles null env field", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile=test-profile"],
              env: null,
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("test-profile");
    });
  });

  describe("edge cases", () => {
    test("handles empty profile value in --profile=", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile="],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("");
    });

    test("handles multiple --profile arguments (uses first one)", async () => {
      const kubeConfig = createBasicKubeConfig({
        users: [{
          name: TEST_USER,
          user: {
            exec: {
              apiVersion: API_VERSION,
              command: AWS_COMMAND,
              args: ["eks", "get-token", "--profile", "first-profile", CLUSTER_NAME_ARG, TEST_CLUSTER, "--profile", "second-profile"],
              env: [],
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }]
      });

      await writeYAMLFile({
        context,
        filePath: join(kubeDir, "config"),
        values: kubeConfig
      });

      const profile = await getAWSProfileForContext({
        context,
        kubeContext: TEST_CONTEXT
      });

      expect(profile).toBe("first-profile");
    });
  });
});