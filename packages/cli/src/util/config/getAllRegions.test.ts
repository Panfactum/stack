// Tests for getAllRegions utility function
// Verifies aggregation of regions across all environments

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { getAllRegions } from "./getAllRegions";
import * as getEnvironmentsModule from "./getEnvironments";
import * as getRegionsModule from "./getRegions";
import type { IEnvironmentMeta } from "./getEnvironments";
import type { IRegionMeta } from "./getRegions";
import type { PanfactumContext } from "@/util/context/context";

let getEnvironmentsMock: ReturnType<typeof spyOn<typeof getEnvironmentsModule, "getEnvironments">>;
let getRegionsMock: ReturnType<typeof spyOn<typeof getRegionsModule, "getRegions">>;

const mockContext = {
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  }
} as unknown as PanfactumContext;

describe("getAllRegions", () => {
  beforeEach(() => {
    getEnvironmentsMock = spyOn(getEnvironmentsModule, "getEnvironments");
    getRegionsMock = spyOn(getRegionsModule, "getRegions");
  });

  afterEach(() => {
    mock.restore();
  });

  test("aggregates regions from multiple environments", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "production",
        path: "/envs/production",
        subdomain: "prod",
        awsProfile: "prod-profile",
        deployed: true
      },
      {
        name: "staging",
        path: "/envs/staging",
        subdomain: "staging",
        awsProfile: "staging-profile",
        deployed: true
      }
    ];

    const mockProductionRegions: IRegionMeta[] = [
      {
        name: "us-east-1",
        path: "/envs/production/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsRegion: "us-east-1",
        clusterContextName: "production-us-east-1",
        vaultAddress: "https://vault.prod.example.com"
      },
      {
        name: "us-west-2",
        path: "/envs/production/us-west-2",
        primary: false,
        clusterDeployed: true,
        bastionDeployed: false,
        awsRegion: "us-west-2",
        clusterContextName: "production-us-west-2",
        vaultAddress: undefined
      }
    ];

    const mockStagingRegions: IRegionMeta[] = [
      {
        name: "us-east-1",
        path: "/envs/staging/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsRegion: "us-east-1",
        clusterContextName: "staging-us-east-1",
        vaultAddress: "https://vault.staging.example.com"
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock
      .mockResolvedValueOnce(mockProductionRegions)
      .mockResolvedValueOnce(mockStagingRegions);

    const result = await getAllRegions(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": "prod-profile",
          "awsRegion": "us-east-1",
          "bastionDeployed": true,
          "clusterContextName": "production-us-east-1",
          "clusterDeployed": true,
          "environment": "production",
          "name": "us-east-1",
          "path": "/envs/production/us-east-1",
          "primary": true,
          "vaultAddress": "https://vault.prod.example.com",
        },
        {
          "awsProfile": "prod-profile",
          "awsRegion": "us-west-2",
          "bastionDeployed": false,
          "clusterContextName": "production-us-west-2",
          "clusterDeployed": true,
          "environment": "production",
          "name": "us-west-2",
          "path": "/envs/production/us-west-2",
          "primary": false,
          "vaultAddress": undefined,
        },
        {
          "awsProfile": "staging-profile",
          "awsRegion": "us-east-1",
          "bastionDeployed": true,
          "clusterContextName": "staging-us-east-1",
          "clusterDeployed": true,
          "environment": "staging",
          "name": "us-east-1",
          "path": "/envs/staging/us-east-1",
          "primary": true,
          "vaultAddress": "https://vault.staging.example.com",
        },
      ]
    `);

    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
    expect(getRegionsMock).toHaveBeenCalledTimes(2);
    expect(getRegionsMock).toHaveBeenNthCalledWith(1, mockContext, "/envs/production");
    expect(getRegionsMock).toHaveBeenNthCalledWith(2, mockContext, "/envs/staging");
  });

  test("handles environments with no regions", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "empty-env",
        path: "/envs/empty",
        subdomain: "empty",
        awsProfile: "empty-profile",
        deployed: false
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock.mockResolvedValue([]);

    const result = await getAllRegions(mockContext);

    expect(result).toEqual([]);
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
    expect(getRegionsMock).toHaveBeenCalledWith(mockContext, "/envs/empty");
  });

  test("returns empty array when no environments exist", async () => {
    getEnvironmentsMock.mockResolvedValue([]);

    const result = await getAllRegions(mockContext);

    expect(result).toEqual([]);
    expect(getEnvironmentsMock).toHaveBeenCalledWith(mockContext);
    expect(getRegionsMock).not.toHaveBeenCalled();
  });

  test("inherits AWS profile from environment when region profile is undefined", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "test-env",
        path: "/envs/test",
        subdomain: "test",
        awsProfile: "env-profile",
        deployed: true
      }
    ];

    const mockRegions: IRegionMeta[] = [
      {
        name: "us-east-1",
        path: "/envs/test/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsProfile: undefined, // No region-specific profile
        awsRegion: "us-east-1",
        clusterContextName: "test-us-east-1",
        vaultAddress: "https://vault.test.example.com"
      },
      {
        name: "us-west-2",
        path: "/envs/test/us-west-2",
        primary: false,
        clusterDeployed: false,
        bastionDeployed: false,
        awsProfile: "region-specific-profile", // Has region-specific profile
        awsRegion: "us-west-2",
        clusterContextName: undefined,
        vaultAddress: undefined
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock.mockResolvedValue(mockRegions);

    const result = await getAllRegions(mockContext);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "awsProfile": "env-profile",
          "awsRegion": "us-east-1",
          "bastionDeployed": true,
          "clusterContextName": "test-us-east-1",
          "clusterDeployed": true,
          "environment": "test-env",
          "name": "us-east-1",
          "path": "/envs/test/us-east-1",
          "primary": true,
          "vaultAddress": "https://vault.test.example.com",
        },
        {
          "awsProfile": "region-specific-profile",
          "awsRegion": "us-west-2",
          "bastionDeployed": false,
          "clusterContextName": undefined,
          "clusterDeployed": false,
          "environment": "test-env",
          "name": "us-west-2",
          "path": "/envs/test/us-west-2",
          "primary": false,
          "vaultAddress": undefined,
        },
      ]
    `);
  });

  test("handles environment with undefined AWS profile", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "no-profile-env",
        path: "/envs/no-profile",
        subdomain: "no-profile",
        awsProfile: undefined,
        deployed: true
      }
    ];

    const mockRegions: IRegionMeta[] = [
      {
        name: "us-east-1",
        path: "/envs/no-profile/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsProfile: undefined,
        awsRegion: "us-east-1",
        clusterContextName: "no-profile-us-east-1",
        vaultAddress: "https://vault.no-profile.example.com"
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock.mockResolvedValue(mockRegions);

    const result = await getAllRegions(mockContext);

    expect(result[0]?.awsProfile).toBeUndefined();
    expect(result[0]?.environment).toBe("no-profile-env");
  });

  test("processes regions in parallel for multiple environments", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "env1",
        path: "/envs/env1",
        subdomain: "env1",
        awsProfile: "profile1",
        deployed: true
      },
      {
        name: "env2",
        path: "/envs/env2",
        subdomain: "env2",
        awsProfile: "profile2",
        deployed: true
      },
      {
        name: "env3",
        path: "/envs/env3",
        subdomain: "env3",
        awsProfile: "profile3",
        deployed: true
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    
    // Mock regions for each environment
    getRegionsMock
      .mockResolvedValueOnce([{
        name: "us-east-1",
        path: "/envs/env1/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsRegion: "us-east-1",
        clusterContextName: "env1-us-east-1",
        vaultAddress: "https://vault.env1.example.com"
      }])
      .mockResolvedValueOnce([{
        name: "us-west-2",
        path: "/envs/env2/us-west-2",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsRegion: "us-west-2",
        clusterContextName: "env2-us-west-2",
        vaultAddress: "https://vault.env2.example.com"
      }])
      .mockResolvedValueOnce([{
        name: "eu-west-1",
        path: "/envs/env3/eu-west-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: true,
        awsRegion: "eu-west-1",
        clusterContextName: "env3-eu-west-1",
        vaultAddress: "https://vault.env3.example.com"
      }]);

    const result = await getAllRegions(mockContext);

    expect(result).toHaveLength(3);
    expect(result.map(r => r.environment)).toEqual(["env1", "env2", "env3"]);
    expect(result.map(r => r.name)).toEqual(["us-east-1", "us-west-2", "eu-west-1"]);
    
    // Verify all environments were processed
    expect(getRegionsMock).toHaveBeenCalledTimes(3);
  });

  test("maintains region metadata properties", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "test-env",
        path: "/envs/test",
        subdomain: "test",
        awsProfile: "test-profile",
        deployed: true
      }
    ];

    const mockRegions: IRegionMeta[] = [
      {
        name: "us-east-1",
        path: "/envs/test/us-east-1",
        primary: true,
        clusterDeployed: true,
        bastionDeployed: false,
        awsProfile: "region-profile",
        awsRegion: "us-east-1",
        clusterContextName: "test-env-us-east-1",
        vaultAddress: "https://vault.test-env.example.com"
      }
    ];

    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock.mockResolvedValue(mockRegions);

    const result = await getAllRegions(mockContext);

    const region = result[0]!;
    expect(region.name).toBe("us-east-1");
    expect(region.path).toBe("/envs/test/us-east-1");
    expect(region.primary).toBe(true);
    expect(region.clusterDeployed).toBe(true);
    expect(region.bastionDeployed).toBe(false);
    expect(region.environment).toBe("test-env");
    expect(region.awsProfile).toBe("region-profile");
  });

  test("propagates errors from getEnvironments", async () => {
    const testError = new Error("Failed to get environments");
    getEnvironmentsMock.mockRejectedValue(testError);

    await expect(getAllRegions(mockContext)).rejects.toThrow("Failed to get environments");
  });

  test("propagates errors from getRegions", async () => {
    const mockEnvironments: IEnvironmentMeta[] = [
      {
        name: "test-env",
        path: "/envs/test",
        subdomain: "test",
        awsProfile: "test-profile",
        deployed: true
      }
    ];

    const testError = new Error("Failed to get regions");
    getEnvironmentsMock.mockResolvedValue(mockEnvironments);
    getRegionsMock.mockRejectedValue(testError);

    await expect(getAllRegions(mockContext)).rejects.toThrow("Failed to get regions");
  });
});