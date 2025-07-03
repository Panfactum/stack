// Tests for getConfigValuesFromFile utility function
// Verifies configuration file reading with various input patterns

import { rm, mkdir, writeFile as nodeWriteFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { stringify } from "yaml";
import * as sopsDecryptModule from "@/util/sops/sopsDecrypt";
import { createTestDir } from "@/util/test/createTestDir";
import * as readYAMLFileModule from "@/util/yaml/readYAMLFile";
import { getConfigValuesFromFile } from "./getConfigValuesFromFile";
import * as getEnvironmentsModule from "./getEnvironments";
import * as getRegionsModule from "./getRegions";
import type { PanfactumContext } from "@/util/context/context";

let testDir: string;
let environmentsDir: string;
let getEnvironmentsMock: ReturnType<typeof spyOn<typeof getEnvironmentsModule, "getEnvironments">>;
let getRegionsMock: ReturnType<typeof spyOn<typeof getRegionsModule, "getRegions">>;
let sopsDecryptMock: ReturnType<typeof spyOn<typeof sopsDecryptModule, "sopsDecrypt">>;
let readYAMLFileMock: ReturnType<typeof spyOn<typeof readYAMLFileModule, "readYAMLFile">>;

const mockContext = {
  devshellConfig: {
    environments_dir: ""
  },
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  },
  env: {
    CI: "false"
  }
} as unknown as PanfactumContext;

describe("getConfigValuesFromFile", () => {
  beforeEach(async () => {
    // Create test directory structure
    const result = await createTestDir({ functionName: "getConfigValuesFromFile" });
    testDir = result.path;
    environmentsDir = join(testDir, "environments");
    
    // Update mock context with test directory
    (mockContext.devshellConfig as { environments_dir: string }).environments_dir = environmentsDir;
    
    // Create environments directory
    await mkdir(environmentsDir, { recursive: true });
    
    // Create spies
    getEnvironmentsMock = spyOn(getEnvironmentsModule, "getEnvironments");
    getRegionsMock = spyOn(getRegionsModule, "getRegions");
    sopsDecryptMock = spyOn(sopsDecryptModule, "sopsDecrypt");
    readYAMLFileMock = spyOn(readYAMLFileModule, "readYAMLFile");
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    
    // Restore mocks
    mock.restore();
  });

  test("reads configuration from direct file path", async () => {
    const configFile = join(testDir, "test-config.yaml");
    const configData = {
      environment: "test",
      aws_region: "us-east-1",
      custom_setting: "value"
    };
    
    await nodeWriteFile(configFile, stringify(configData), "utf8");
    
    readYAMLFileMock.mockResolvedValue(configData);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      filePath: configFile
    });

    expect(result).toEqual(configData);
    expect(readYAMLFileMock).toHaveBeenCalledWith({
      context: mockContext,
      filePath: configFile,
      throwOnEmpty: false,
      throwOnMissing: false,
      validationSchema: expect.any(Object)
    });
  });

  test("reads secret configuration using sopsDecrypt", async () => {
    const secretConfigFile = join(testDir, "secret-config.yaml");
    const secretData = {
      vault_token: "secret-token",
      api_key: "secret-key"
    };
    
    await nodeWriteFile(secretConfigFile, "encrypted-content", "utf8");
    
    sopsDecryptMock.mockResolvedValue(secretData);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      filePath: secretConfigFile,
      secret: true
    });

    expect(result).toEqual(secretData);
    expect(sopsDecryptMock).toHaveBeenCalledWith({
      context: mockContext,
      filePath: secretConfigFile,
      throwOnMissing: false,
      validationSchema: expect.any(Object)
    });
  });

  test("reads module configuration by hierarchy", async () => {
    const environmentName = "production";
    const regionName = "us-east-1";
    const moduleName = "kube_cluster";
    
    const envPath = join(environmentsDir, environmentName);
    const regionPath = join(envPath, regionName);
    const modulePath = join(regionPath, moduleName);
    const moduleConfigFile = join(modulePath, "module.yaml");
    
    await mkdir(modulePath, { recursive: true });
    
    const moduleConfig = {
      extra_inputs: {
        replica_count: 3,
        instance_type: "t3.medium"
      }
    };
    
    await nodeWriteFile(moduleConfigFile, stringify(moduleConfig), "utf8");
    
    // Mock environment and region discovery
    getEnvironmentsMock.mockResolvedValue([
      { name: environmentName, path: envPath, subdomain: "prod", awsProfile: "prod-profile", deployed: true }
    ]);
    getRegionsMock.mockResolvedValue([
      { name: regionName, path: regionPath, primary: true, clusterDeployed: true, bastionDeployed: true, awsRegion: "us-east-1", clusterContextName: "prod-us-east-1", vaultAddress: "https://vault.prod.example.com" }
    ]);
    
    readYAMLFileMock.mockResolvedValue(moduleConfig);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      environment: environmentName,
      region: regionName,
      module: moduleName
    });

    expect(result).toEqual(moduleConfig);
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
    expect(getRegionsMock).toHaveBeenCalledWith(mockContext, envPath);
  });

  test("reads region configuration by hierarchy", async () => {
    const environmentName = "staging";
    const regionName = "eu-west-1";
    
    const envPath = join(environmentsDir, environmentName);
    const regionPath = join(envPath, regionName);
    const regionConfigFile = join(regionPath, "region.yaml");
    
    await mkdir(regionPath, { recursive: true });
    
    const regionConfig = {
      aws_region: regionName,
      aws_secondary_region: "eu-central-1"
    };
    
    await nodeWriteFile(regionConfigFile, stringify(regionConfig), "utf8");
    
    // Mock environment discovery
    getEnvironmentsMock.mockResolvedValue([
      { name: environmentName, path: envPath, subdomain: "staging", awsProfile: "staging-profile", deployed: true }
    ]);
    
    readYAMLFileMock.mockResolvedValue(regionConfig);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      environment: environmentName,
      region: regionName
    });

    expect(result).toEqual(regionConfig);
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
  });

  test("reads environment configuration by hierarchy", async () => {
    const environmentName = "development";
    
    const envPath = join(environmentsDir, environmentName);
    const envConfigFile = join(envPath, "environment.yaml");
    
    await mkdir(envPath, { recursive: true });
    
    const envConfig = {
      environment: environmentName,
      aws_account_id: "123456789012",
      aws_profile: "dev-profile"
    };
    
    await nodeWriteFile(envConfigFile, stringify(envConfig), "utf8");
    
    // Mock environment discovery
    getEnvironmentsMock.mockResolvedValue([
      { name: environmentName, path: envPath, subdomain: "dev", awsProfile: "dev-profile", deployed: false }
    ]);
    
    readYAMLFileMock.mockResolvedValue(envConfig);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      environment: environmentName
    });

    expect(result).toEqual(envConfig);
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
  });

  test("reads global configuration", async () => {
    const globalConfigFile = join(environmentsDir, "global.yaml");
    
    const globalConfig = {
      pf_stack_version: "24.05.1",
      domains: {
        "example.com": {
          zone_id: "Z1234567890ABC",
          record_manager_role_arn: "arn:aws:iam::123456789012:role/DNSManager"
        }
      }
    };
    
    await nodeWriteFile(globalConfigFile, stringify(globalConfig), "utf8");
    
    readYAMLFileMock.mockResolvedValue(globalConfig);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      filePath: globalConfigFile
    });

    expect(result).toEqual(globalConfig);
    expect(readYAMLFileMock).toHaveBeenCalledWith({
      context: mockContext,
      filePath: globalConfigFile,
      throwOnEmpty: false,
      throwOnMissing: false,
      validationSchema: expect.any(Object)
    });
  });

  test("returns null when configuration file does not exist", async () => {
    readYAMLFileMock.mockResolvedValue(null);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      filePath: join(testDir, "nonexistent.yaml")
    });

    expect(result).toBeNull();
  });

  test("returns null when environment does not exist", async () => {
    getEnvironmentsMock.mockResolvedValue([]);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      environment: "nonexistent-env"
    });

    expect(result).toBeNull();
  });

  test("handles secret file suffix correctly", async () => {
    const secretConfigFile = join(testDir, "test.secrets.yaml");
    const secretData = { secret_key: "value" };
    
    sopsDecryptMock.mockResolvedValue(secretData);

    await getConfigValuesFromFile({
      context: mockContext,
      filePath: secretConfigFile,
      secret: true
    });

    expect(sopsDecryptMock).toHaveBeenCalledWith({
      context: mockContext,
      filePath: secretConfigFile,
      throwOnMissing: false,
      validationSchema: expect.any(Object)
    });
  });


  test("returns null when environment is not found for module config", async () => {
    const environmentName = "test-env";
    const regionName = "test-region";
    const moduleName = "test-module";
    
    // Mock environment not found
    getEnvironmentsMock.mockResolvedValue([]);
    readYAMLFileMock.mockResolvedValue(null);

    const result = await getConfigValuesFromFile({
      context: mockContext,
      environment: environmentName,
      region: regionName,
      module: moduleName
    });

    expect(result).toBeNull();
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
    // readYAMLFile should not be called when environment is not found
    expect(readYAMLFileMock).not.toHaveBeenCalled();
  });

  test("propagates errors from file reading operations", async () => {
    const testError = new Error("File read error");
    readYAMLFileMock.mockRejectedValue(testError);

    await expect(
      getConfigValuesFromFile({
        context: mockContext,
        filePath: join(testDir, "test.yaml")
      })
    ).rejects.toThrow("File read error");
  });

  test("propagates errors from sops decryption", async () => {
    const decryptError = new Error("Decryption failed");
    sopsDecryptMock.mockRejectedValue(decryptError);

    await expect(
      getConfigValuesFromFile({
        context: mockContext,
        filePath: join(testDir, "secret.yaml"),
        secret: true
      })
    ).rejects.toThrow("Decryption failed");
  });
});