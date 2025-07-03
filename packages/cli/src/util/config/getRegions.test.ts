// Tests for getRegions utility function
// Verifies region discovery and metadata extraction within environments

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { GLOBAL_REGION } from "@/util/terragrunt/constants";
import { createTestDir } from "@/util/test/createTestDir";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { REGION_CONFIG } from "./constants";
import * as getPanfactumConfigModule from "./getPanfactumConfig";
import { getRegions } from "./getRegions";
import * as isBastionDeployedModule from "./isBastionDeployed";
import * as isClusterDeployedModule from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let environmentPath: string;
let getPanfactumConfigMock: ReturnType<typeof spyOn<typeof getPanfactumConfigModule, "getPanfactumConfig">>;
let isBastionDeployedMock: ReturnType<typeof spyOn<typeof isBastionDeployedModule, "isBastionDeployed">>;
let isClusterDeployedMock: ReturnType<typeof spyOn<typeof isClusterDeployedModule, "isClusterDeployed">>;


const mockContext = {
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  }
} as unknown as PanfactumContext;

describe("getRegions", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "getRegions" });
    testDir = result.path;
    environmentPath = join(testDir, "production");
    
    // Create environment directory
    await mkdir(environmentPath, { recursive: true });
    
    // Create spies
    getPanfactumConfigMock = spyOn(getPanfactumConfigModule, "getPanfactumConfig");
    isBastionDeployedMock = spyOn(isBastionDeployedModule, "isBastionDeployed");
    isClusterDeployedMock = spyOn(isClusterDeployedModule, "isClusterDeployed");
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    
    // Restore mocks
    mock.restore();
  });

  test("discovers regions with region.yaml files", async () => {
    // Create us-east-1 region
    const usEast1Dir = join(environmentPath, "us-east-1");
    await mkdir(usEast1Dir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(usEast1Dir, REGION_CONFIG),
      values: {
        region: "us-east-1",
        aws_region: "us-east-1",
        vault_addr: "https://vault.us-east-1.example.com"
      }
    });

    // Create us-west-2 region
    const usWest2Dir = join(environmentPath, "us-west-2");
    await mkdir(usWest2Dir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(usWest2Dir, REGION_CONFIG),
      values: {
        region: "us-west-2",
        aws_region: "us-west-2",
        vault_addr: "https://vault.us-west-2.example.com"
      }
    });

    // Mock environment config (for tf_state_region)
    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === usEast1Dir) {
        return {
          region: "us-east-1",
          aws_region: "us-east-1",
          vault_addr: "https://vault.us-east-1.example.com",
          environment: "production",
          kube_api_server: "https://api.us-east-1.example.com",
          kube_config_context: "production-us-east-1"
        };
      }
      if ((directory as string) === usWest2Dir) {
        return {
          region: "us-west-2",
          aws_region: "us-west-2",
          vault_addr: "https://vault.us-west-2.example.com",
          environment: "production",
          kube_api_server: "https://api.us-west-2.example.com",
          kube_config_context: "production-us-west-2"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    // Sort by name to ensure deterministic order
    const sortedResult = result.sort((a, b) => a.name.localeCompare(b.name));

    expect(sortedResult).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": undefined,
          "awsRegion": "us-east-1",
          "bastionDeployed": false,
          "clusterContextName": "production-us-east-1",
          "clusterDeployed": true,
          "name": "us-east-1",
          "path": "${usEast1Dir}",
          "primary": true,
          "vaultAddress": "https://vault.us-east-1.example.com",
        },
        {
          "awsProfile": undefined,
          "awsRegion": "us-west-2",
          "bastionDeployed": false,
          "clusterContextName": "production-us-west-2",
          "clusterDeployed": true,
          "name": "us-west-2",
          "path": "${usWest2Dir}",
          "primary": false,
          "vaultAddress": "https://vault.us-west-2.example.com",
        },
      ]
    `);
  });

  test("identifies primary region based on tf_state_region", async () => {
    const region1Dir = join(environmentPath, "us-west-1");
    const region2Dir = join(environmentPath, "eu-west-1");
    
    await mkdir(region1Dir, { recursive: true });
    await mkdir(region2Dir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(region1Dir, REGION_CONFIG),
      values: null
    });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(region2Dir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "eu-west-1" };
      }
      if ((directory as string) === region1Dir) {
        return { aws_region: "us-west-1", environment: "test", region: "us-west-1" };
      }
      if ((directory as string) === region2Dir) {
        return { aws_region: "eu-west-1", environment: "test", region: "eu-west-1" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result.find(r => r.name === "us-west-1")?.primary).toBe(false);
    expect(result.find(r => r.name === "eu-west-1")?.primary).toBe(true);
  });

  test("excludes global region from being primary", async () => {
    const globalDir = join(environmentPath, GLOBAL_REGION);
    await mkdir(globalDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(globalDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "global" };
      }
      if ((directory as string) === globalDir) {
        return { aws_region: "global", region: GLOBAL_REGION, environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result.find(r => r.name === GLOBAL_REGION)?.primary).toBe(false);
  });

  test("uses directory name when region name not in config", async () => {
    const regionDir = join(environmentPath, "custom-region-name");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: {
        aws_region: "ap-southeast-1"
      }
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return { aws_region: "ap-southeast-1", environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.name).toBe("custom-region-name");
    expect(result[0]?.awsRegion).toBe("ap-southeast-1");
  });

  test("checks cluster deployment status correctly", async () => {
    const regionDir = join(environmentPath, "test-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return {
          region: "test-region",
          aws_region: "us-east-1",
          environment: "staging",
          kube_api_server: "https://api.staging.example.com"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.clusterDeployed).toBe(true);
    expect(isClusterDeployedMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "staging",
      region: "test-region"
    });
  });

  test("does not deploy cluster when missing required config", async () => {
    const regionDir = join(environmentPath, "incomplete-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        // Missing kube_api_server
        return { region: "incomplete-region", environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.clusterDeployed).toBe(false);
    expect(isClusterDeployedMock).not.toHaveBeenCalled();
  });

  test("checks bastion deployment when cluster is deployed", async () => {
    const regionDir = join(environmentPath, "bastion-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return {
          region: "bastion-region",
          aws_region: "us-east-1",
          environment: "production",
          kube_api_server: "https://api.production.example.com"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockResolvedValue(true);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.clusterDeployed).toBe(true);
    expect(result[0]?.bastionDeployed).toBe(true);
    expect(isBastionDeployedMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "production",
      region: "bastion-region"
    });
  });

  test("does not check bastion when cluster is not deployed", async () => {
    const regionDir = join(environmentPath, "no-cluster-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return { region: "no-cluster-region", environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(true);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.clusterDeployed).toBe(false);
    expect(result[0]?.bastionDeployed).toBe(false);
    expect(isBastionDeployedMock).not.toHaveBeenCalled();
  });

  test("includes all region metadata fields", async () => {
    const regionDir = join(environmentPath, "full-config-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "eu-central-1" };
      }
      if ((directory as string) === regionDir) {
        return {
          region: "full-config-region",
          aws_region: "eu-central-1",
          aws_profile: "custom-profile",
          environment: "staging",
          kube_api_server: "https://api.staging.example.com",
          kube_config_context: "staging-eu-central-1",
          vault_addr: "https://vault.staging.example.com"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockResolvedValue(true);

    const result = await getRegions(mockContext, environmentPath);

    const region = result[0]!;
    expect(region.name).toBe("full-config-region");
    expect(region.awsRegion).toBe("eu-central-1");
    expect(region.awsProfile).toBe("custom-profile");
    expect(region.primary).toBe(true);
    expect(region.clusterDeployed).toBe(true);
    expect(region.bastionDeployed).toBe(true);
    expect(region.clusterContextName).toBe("staging-eu-central-1");
    expect(region.vaultAddress).toBe("https://vault.staging.example.com");
    expect(region.path).toBe(regionDir);
  });

  test("returns empty array when no regions exist", async () => {
    getPanfactumConfigMock.mockResolvedValue({ tf_state_region: "us-east-1" });

    const result = await getRegions(mockContext, environmentPath);

    expect(result).toEqual([]);
  });

  test("ignores directories without region.yaml files", async () => {
    // Create directories without region.yaml
    const invalidDir1 = join(environmentPath, "no-config");
    const invalidDir2 = join(environmentPath, "wrong-config");
    await mkdir(invalidDir1, { recursive: true });
    await mkdir(invalidDir2, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(invalidDir2, "other.yaml"),
      values: "content"
    });

    // Create valid region
    const validDir = join(environmentPath, "valid-region");
    await mkdir(validDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(validDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === validDir) {
        return { region: "valid-region", environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("valid-region");
  });

  test("handles regions with undefined aws_region", async () => {
    const regionDir = join(environmentPath, "no-aws-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return { region: "no-aws-region", environment: "test" };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(false);
    isBastionDeployedMock.mockResolvedValue(false);

    const result = await getRegions(mockContext, environmentPath);

    expect(result[0]?.awsRegion).toBeUndefined();
    expect(result[0]?.primary).toBe(false);
  });

  test("throws CLIError when getPanfactumConfig fails", async () => {
    const regionDir = join(environmentPath, "broken-region");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        throw new Error("Config parsing failed");
      }
      return {};
    });

    await expect(getRegions(mockContext, environmentPath)).rejects.toThrow("Unable to get regions");
  });

  test("throws CLIError when isClusterDeployed fails", async () => {
    const regionDir = join(environmentPath, "cluster-check-fails");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return {
          region: "cluster-check-fails",
          environment: "test",
          kube_api_server: "https://api.test.example.com"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockImplementation(() => {
      throw new Error("Cluster status check failed");
    });

    await expect(getRegions(mockContext, environmentPath)).rejects.toThrow("Unable to get regions");
  });

  test("throws CLIError when isBastionDeployed fails", async () => {
    const regionDir = join(environmentPath, "bastion-check-fails");
    await mkdir(regionDir, { recursive: true });
    await writeYAMLFile({
      context: mockContext,
      filePath: join(regionDir, REGION_CONFIG),
      values: null
    });

    getPanfactumConfigMock.mockImplementation(async ({ directory }) => {
      if ((directory as string) === environmentPath) {
        return { tf_state_region: "us-east-1" };
      }
      if ((directory as string) === regionDir) {
        return {
          region: "bastion-check-fails",
          environment: "test",
          kube_api_server: "https://api.test.example.com"
        };
      }
      return {};
    });

    isClusterDeployedMock.mockResolvedValue(true);
    isBastionDeployedMock.mockImplementation(() => {
      throw new Error("Bastion status check failed");
    });

    await expect(getRegions(mockContext, environmentPath)).rejects.toThrow("Unable to get regions");
  });
});