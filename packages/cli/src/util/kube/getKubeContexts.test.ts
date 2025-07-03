// Unit tests for getKubeContexts function
// Tests the extraction and parsing of Kubernetes contexts from kubectl config files

import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { getKubeContexts } from "@/util/kube/getKubeContexts";
import { createTestDir } from "@/util/test/createTestDir";
import type { PanfactumContext } from "@/util/context/context";

describe("getKubeContexts", () => {
  let testDir: string;
  let mockContext: PanfactumContext;

  beforeEach(async () => {
    const result = await createTestDir({ functionName: "getKubeContexts" });
    testDir = result.path;
    
    // Create mock context with test directory and logger
    mockContext = {
      devshellConfig: {
        kube_dir: testDir
      },
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    } as unknown as PanfactumContext;
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("should return empty array when config file doesn't exist", async () => {
    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`[]`);
  });

  test("should return empty array when config file is empty", async () => {
    const configPath = join(testDir, "config");
    await writeFile(configPath, "");

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`[]`);
  });

  test("should parse valid kubeconfig with single context", async () => {
    const configPath = join(testDir, "config");
    const kubeConfig = {
      apiVersion: "v1",
      kind: "Config",
      "current-context": "test-context",
      clusters: [
        {
          name: "test-cluster",
          cluster: {
            server: "https://k8s.example.com",
            "certificate-authority-data": "LS0tLS1CRUdJTi..."
          }
        }
      ],
      users: [
        {
          name: "test-user",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: ["eks", "get-token", "--cluster-name", "test-cluster"]
            }
          }
        }
      ],
      contexts: [
        {
          name: "test-context",
          context: {
            cluster: "test-cluster",
            user: "test-user",
            namespace: "default"
          }
        }
      ]
    };

    await writeFile(configPath, JSON.stringify(kubeConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "test-cluster",
          "name": "test-context",
          "namespace": "default",
          "user": "test-user",
        },
      ]
    `);
  });

  test("should parse kubeconfig with multiple contexts", async () => {
    const configPath = join(testDir, "config");
    const kubeConfig = {
      apiVersion: "v1",
      kind: "Config",
      "current-context": "production",
      clusters: [
        {
          name: "production-cluster",
          cluster: {
            server: "https://prod.k8s.example.com",
            "certificate-authority-data": "LS0tLS1CRUdJTi..."
          }
        },
        {
          name: "staging-cluster",
          cluster: {
            server: "https://staging.k8s.example.com",
            "certificate-authority-data": "LS0tLS1CRUdJTi..."
          }
        }
      ],
      users: [
        {
          name: "prod-user",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: ["eks", "get-token", "--cluster-name", "production"]
            }
          }
        },
        {
          name: "staging-user",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: ["eks", "get-token", "--cluster-name", "staging"]
            }
          }
        }
      ],
      contexts: [
        {
          name: "production",
          context: {
            cluster: "production-cluster",
            user: "prod-user",
            namespace: "kube-system"
          }
        },
        {
          name: "staging",
          context: {
            cluster: "staging-cluster",
            user: "staging-user"
          }
        }
      ]
    };

    await writeFile(configPath, JSON.stringify(kubeConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "production-cluster",
          "name": "production",
          "namespace": "kube-system",
          "user": "prod-user",
        },
        {
          "cluster": "staging-cluster",
          "name": "staging",
          "namespace": undefined,
          "user": "staging-user",
        },
      ]
    `);
  });

  test("should handle context without namespace", async () => {
    const configPath = join(testDir, "config");
    const kubeConfig = {
      apiVersion: "v1",
      kind: "Config",
      contexts: [
        {
          name: "minimal-context",
          context: {
            cluster: "minimal-cluster",
            user: "minimal-user"
          }
        }
      ]
    };

    await writeFile(configPath, JSON.stringify(kubeConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "minimal-cluster",
          "name": "minimal-context",
          "namespace": undefined,
          "user": "minimal-user",
        },
      ]
    `);
  });

  test("should handle empty contexts array", async () => {
    const configPath = join(testDir, "config");
    const kubeConfig = {
      apiVersion: "v1",
      kind: "Config",
      contexts: []
    };

    await writeFile(configPath, JSON.stringify(kubeConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`[]`);
  });

  test("should handle missing contexts field", async () => {
    const configPath = join(testDir, "config");
    const kubeConfig = {
      apiVersion: "v1",
      kind: "Config"
    };

    await writeFile(configPath, JSON.stringify(kubeConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`[]`);
  });

  test("should handle YAML format kubeconfig", async () => {
    const configPath = join(testDir, "config");
    const yamlConfig = `
apiVersion: v1
kind: Config
current-context: yaml-context
clusters:
- name: yaml-cluster
  cluster:
    server: https://yaml.k8s.example.com
    certificate-authority-data: LS0tLS1CRUdJTi...
users:
- name: yaml-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: kubectl
      args:
      - get-token
contexts:
- name: yaml-context
  context:
    cluster: yaml-cluster
    user: yaml-user
    namespace: yaml-namespace
`;

    await writeFile(configPath, yamlConfig);

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "yaml-cluster",
          "name": "yaml-context",
          "namespace": "yaml-namespace",
          "user": "yaml-user",
        },
      ]
    `);
  });

  test("should handle real-world AWS EKS kubeconfig format", async () => {
    const configPath = join(testDir, "config");
    const eksConfig = {
      apiVersion: "v1",
      kind: "Config",
      "current-context": "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
      clusters: [
        {
          name: "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
          cluster: {
            server: "https://A1B2C3D4E5F6G7H8I9J0.gr7.us-east-1.eks.amazonaws.com",
            "certificate-authority-data": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t..."
          }
        }
      ],
      users: [
        {
          name: "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: [
                "eks",
                "get-token",
                "--cluster-name",
                "my-cluster"
              ],
              env: null,
              interactiveMode: "IfAvailable",
              provideClusterInfo: false
            }
          }
        }
      ],
      contexts: [
        {
          name: "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
          context: {
            cluster: "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
            user: "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster"
          }
        }
      ]
    };

    await writeFile(configPath, JSON.stringify(eksConfig));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
          "name": "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
          "namespace": undefined,
          "user": "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
        },
      ]
    `);
  });

  test("should handle kubeconfig with additional fields", async () => {
    const configPath = join(testDir, "config");
    const configWithExtras = {
      apiVersion: "v1",
      kind: "Config",
      "current-context": "test-context",
      preferences: {
        colors: true
      },
      clusters: [
        {
          name: "test-cluster",
          cluster: {
            server: "https://k8s.example.com",
            "certificate-authority-data": "LS0tLS1CRUdJTi...",
            "proxy-url": "http://proxy.example.com:8080"
          }
        }
      ],
      users: [
        {
          name: "test-user",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: ["eks", "get-token"],
              env: [
                {
                  name: "AWS_REGION",
                  value: "us-east-1"
                }
              ]
            }
          }
        }
      ],
      contexts: [
        {
          name: "test-context",
          context: {
            cluster: "test-cluster",
            user: "test-user",
            namespace: "default"
          }
        }
      ],
      extensions: [
        {
          name: "test-extension",
          extension: {
            version: "1.0"
          }
        }
      ]
    };

    await writeFile(configPath, JSON.stringify(configWithExtras));

    const result = await getKubeContexts(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "cluster": "test-cluster",
          "name": "test-context",
          "namespace": "default",
          "user": "test-user",
        },
      ]
    `);
  });
});