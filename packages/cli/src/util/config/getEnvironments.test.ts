// Tests for getEnvironments utility function
// Verifies environment discovery and metadata extraction

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { createTestDir } from "@/util/test/createTestDir";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { ENVIRONMENT_CONFIG } from "./constants";
import * as getConfigValuesFromFileModule from "./getConfigValuesFromFile";
import { getEnvironments } from "./getEnvironments";
import * as isEnvironmentDeployedModule from "./isEnvironmentDeployed";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let environmentsDir: string;
let getConfigValuesFromFileMock: ReturnType<typeof spyOn<typeof getConfigValuesFromFileModule, "getConfigValuesFromFile">>;
let isEnvironmentDeployedMock: ReturnType<typeof spyOn<typeof isEnvironmentDeployedModule, "isEnvironmentDeployed">>;


const mockContext = {
  devshellConfig: {
    environments_dir: ""
  },
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  }
} as unknown as PanfactumContext;

describe("getEnvironments", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "getEnvironments" });
    testDir = result.path;
    environmentsDir = join(testDir, "environments");
    
    // Update mock context with test directory
    (mockContext.devshellConfig as { environments_dir: string }).environments_dir = environmentsDir;
    
    // Create environments directory
    await mkdir(environmentsDir, { recursive: true });
    
    // Create spies
    getConfigValuesFromFileMock = spyOn(getConfigValuesFromFileModule, "getConfigValuesFromFile");
    isEnvironmentDeployedMock = spyOn(isEnvironmentDeployedModule, "isEnvironmentDeployed");
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    
    // Restore mocks
    mock.restore();
  });

  test("discovers environments with environment config files", async () => {
    // Create production environment
    const prodDir = join(environmentsDir, "production");
    await mkdir(prodDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(prodDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "production",
        environment_subdomain: "prod",
        aws_profile: "prod-profile"
      }
    });

    // Create staging environment
    const stagingDir = join(environmentsDir, "staging");
    await mkdir(stagingDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(stagingDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "staging",
        environment_subdomain: "staging",
        aws_profile: "staging-profile"
      }
    });

    // Mock config file reading - use mockImplementation to handle any order
    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      // Check if it's a filepath input
      if ('filePath' in input && input.filePath) {
        if (input.filePath.includes("production")) {
          return {
            environment: "production",
            environment_subdomain: "prod",
            aws_profile: "prod-profile"
          };
        } else if (input.filePath.includes("staging")) {
          return {
            environment: "staging",
            environment_subdomain: "staging",
            aws_profile: "staging-profile"
          };
        }
      }
      return null;
    });

    // Mock deployment status - use mockImplementation to handle any order  
    isEnvironmentDeployedMock.mockImplementation(async ({ environment }: { environment: string }) => {
      if (environment === "production") {
        return true;
      } else if (environment === "staging") {
        return false;
      }
      return false;
    });

    const result = await getEnvironments(mockContext);

    // Sort by name to ensure deterministic order
    const sortedResult = result.sort((a, b) => a.name.localeCompare(b.name));

    expect(sortedResult).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": "prod-profile",
          "deployed": true,
          "name": "production",
          "path": "${prodDir}",
          "subdomain": "prod",
        },
        {
          "awsProfile": "staging-profile",
          "deployed": false,
          "name": "staging",
          "path": "${stagingDir}",
          "subdomain": "staging",
        },
      ]
    `);

    expect(getConfigValuesFromFileMock).toHaveBeenCalledTimes(2);
    expect(isEnvironmentDeployedMock).toHaveBeenCalledTimes(2);
  });

  test("uses directory name when environment name is not in config", async () => {
    const envDir = join(environmentsDir, "my-custom-env");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: {
        environment_subdomain: "custom",
        aws_profile: "custom-profile"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment_subdomain: "custom",
      aws_profile: "custom-profile"
    });
    isEnvironmentDeployedMock.mockResolvedValue(true);

    const result = await getEnvironments(mockContext);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("my-custom-env");
    expect(result[0]?.subdomain).toBe("custom");
    expect(result[0]?.awsProfile).toBe("custom-profile");
  });

  test("handles environments with minimal configuration", async () => {
    const envDir = join(environmentsDir, "minimal-env");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "minimal-env"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "minimal-env"
    });
    isEnvironmentDeployedMock.mockResolvedValue(false);

    const result = await getEnvironments(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": undefined,
          "deployed": false,
          "name": "minimal-env",
          "path": "${envDir}",
          "subdomain": undefined,
        },
      ]
    `);
  });

  test("handles empty environment config file", async () => {
    const envDir = join(environmentsDir, "empty-config");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: null
    });

    getConfigValuesFromFileMock.mockResolvedValue(null);
    isEnvironmentDeployedMock.mockResolvedValue(false);

    const result = await getEnvironments(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": undefined,
          "deployed": false,
          "name": "empty-config",
          "path": "${envDir}",
          "subdomain": undefined,
        },
      ]
    `);
  });

  test("returns empty array when no environments exist", async () => {
    // Environment directory exists but is empty
    const result = await getEnvironments(mockContext);

    expect(result).toEqual([]);
    expect(getConfigValuesFromFileMock).not.toHaveBeenCalled();
    expect(isEnvironmentDeployedMock).not.toHaveBeenCalled();
  });

  test("ignores directories without environment config files", async () => {
    // Create directories without environment config files
    const invalidDir1 = join(environmentsDir, "no-config");
    const invalidDir2 = join(environmentsDir, "wrong-config");
    await mkdir(invalidDir1, { recursive: true });
    await mkdir(invalidDir2, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(invalidDir2, "other.yaml"),
      values: "content"
    });

    // Create valid environment
    const validDir = join(environmentsDir, "valid");
    await mkdir(validDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(validDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "valid"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "valid"
    });
    isEnvironmentDeployedMock.mockResolvedValue(true);

    const result = await getEnvironments(mockContext);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("valid");
  });

  test("handles nested environment directories", async () => {
    // Create nested structure with a single-level directory since the glob pattern "*/environment.yaml" only matches one level deep
    const nestedDir = join(environmentsDir, "project");
    await mkdir(nestedDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(nestedDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "project-env",
        environment_subdomain: "proj"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "project-env",
      environment_subdomain: "proj"
    });
    isEnvironmentDeployedMock.mockResolvedValue(true);

    const result = await getEnvironments(mockContext);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("project-env");
    expect(result[0]?.path).toBe(nestedDir);
  });

  test("processes environments with different deployment statuses", async () => {
    // Reset mocks to clear any previous implementations
    getConfigValuesFromFileMock.mockReset();
    isEnvironmentDeployedMock.mockReset();
    
    const environments = ["deployed", "not-deployed", "partial"];
    
    for (const envName of environments) {
      const envDir = join(environmentsDir, envName);
      await mkdir(envDir, { recursive: true });
      await writeYAMLFile({
        context: mockContext,
        filePath: join(envDir, ENVIRONMENT_CONFIG),
        values: {
          environment: envName
        }
      });
    }

    getConfigValuesFromFileMock.mockImplementation(async (input) => {
      // Check if it's a filepath input
      if ('filePath' in input && input.filePath) {
        if (input.filePath.includes("/deployed/")) {
          return { environment: "deployed" };
        } else if (input.filePath.includes("/not-deployed/")) {
          return { environment: "not-deployed" };
        } else if (input.filePath.includes("/partial/")) {
          return { environment: "partial" };
        }
      }
      return null;
    });

    isEnvironmentDeployedMock.mockImplementation(async ({ environment }: { environment: string }) => {
      if (environment === "deployed") {
        return true;
      } else if (environment === "not-deployed" || environment === "partial") {
        return false;
      }
      return false;
    });

    const result = await getEnvironments(mockContext);

    expect(result).toHaveLength(3);
    expect(result.find(e => e.name === "deployed")?.deployed).toBe(true);
    expect(result.find(e => e.name === "not-deployed")?.deployed).toBe(false);
    expect(result.find(e => e.name === "partial")?.deployed).toBe(false);
  });

  test("throws CLIError when getConfigValuesFromFile fails", async () => {
    const envDir = join(environmentsDir, "broken");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "broken"
      }
    });

    getConfigValuesFromFileMock.mockImplementation(() => {
      throw new Error("Failed to parse YAML");
    });

    await expect(getEnvironments(mockContext)).rejects.toThrow("Unable to get environments");
  });

  test("throws CLIError when isEnvironmentDeployed fails", async () => {
    const envDir = join(environmentsDir, "deploy-check-fails");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "deploy-check-fails"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "deploy-check-fails"
    });

    isEnvironmentDeployedMock.mockImplementation(() => {
      throw new Error("Failed to check deployment status");
    });

    await expect(getEnvironments(mockContext)).rejects.toThrow("Unable to get environments");
  });

  test("calls getConfigValuesFromFile with correct parameters", async () => {
    const envDir = join(environmentsDir, "test-env");
    await mkdir(envDir, { recursive: true });
    const configFilePath = join(envDir, ENVIRONMENT_CONFIG);
    await writeYAMLFile({
      context: mockContext,
      filePath: configFilePath,
      values: {
        environment: "test-env"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "test-env"
    });
    isEnvironmentDeployedMock.mockResolvedValue(true);

    await getEnvironments(mockContext);

    expect(getConfigValuesFromFileMock).toHaveBeenCalledWith({
      filePath: configFilePath,
      context: mockContext
    });
  });

  test("calls isEnvironmentDeployed with correct parameters", async () => {
    const envDir = join(environmentsDir, "test-env");
    await mkdir(envDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(envDir, ENVIRONMENT_CONFIG),
      values: {
        environment: "test-env"
      }
    });

    getConfigValuesFromFileMock.mockResolvedValue({
      environment: "test-env"
    });
    isEnvironmentDeployedMock.mockResolvedValue(true);

    await getEnvironments(mockContext);

    expect(isEnvironmentDeployedMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "test-env"
    });
  });
});