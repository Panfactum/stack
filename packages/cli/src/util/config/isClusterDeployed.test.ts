// Tests for isClusterDeployed utility function
// Verifies Kubernetes cluster deployment status checking

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { MODULES } from "@/util/terragrunt/constants";
import * as getModuleStatusModule from "@/util/terragrunt/getModuleStatus";
import { createTestDir } from "@/util/test/createTestDir";
import { writeYAMLFile } from "@/util/yaml/writeYAMLFile";
import { isClusterDeployed } from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

let getModuleStatusMock: ReturnType<typeof spyOn<typeof getModuleStatusModule, "getModuleStatus">>;

const ALL_EXTENSION_MODULES = [
  MODULES.KUBE_BASTION,
  MODULES.KUBE_EXTERNAL_SNAPSHOTTER,
  MODULES.KUBE_VELERO,
  MODULES.KUBE_KEDA,
  MODULES.KUBE_RELOADER,
  MODULES.KUBE_PVC_AUTORESIZER,
  MODULES.KUBE_DESCHEDULER,
  MODULES.KUBE_CLOUDNATIVE_PG,
] as const;

const ANTI_AFFINITY_MODULES = [
  MODULES.AWS_EKS,
  MODULES.KUBE_VAULT,
  MODULES.KUBE_CERTIFICATES,
  MODULES.KUBE_LINKERD,
  MODULES.KUBE_INGRESS_NGINX,
] as const;

const SUCCESS_STATUS = {
  environment_exists: true,
  region_exists: true,
  module_exists: true,
  init_status: "success" as const,
  deploy_status: "success" as const,
};

/** Creates real module.yaml files with bootstrap_mode_enabled for each anti-affinity module */
async function writeAntiAffinityModuleYamls(
  regionPath: string,
  bootstrapModeEnabled: boolean,
  context: PanfactumContext
) {
  for (const module of ANTI_AFFINITY_MODULES) {
    const moduleDir = join(regionPath, module);
    await mkdir(moduleDir, { recursive: true });
    await writeYAMLFile({
      context,
      filePath: join(moduleDir, "module.yaml"),
      values: {
        extra_inputs: {
          bootstrap_mode_enabled: bootstrapModeEnabled,
        },
      },
    });
  }
}

describe("isClusterDeployed", () => {
  let testDir: string;
  let regionPath: string;
  let mockContext: PanfactumContext;

  beforeEach(async () => {
    const result = await createTestDir({ functionName: "isClusterDeployed" });
    testDir = result.path;
    // getModuleStatus uses environments_dir/environment/region as the region path
    regionPath = join(testDir, "production", "us-east-1");
    await mkdir(regionPath, { recursive: true });

    mockContext = {
      logger: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      },
      devshellConfig: {
        environments_dir: join(testDir),
      },
    } as unknown as PanfactumContext;

    getModuleStatusMock = spyOn(getModuleStatusModule, "getModuleStatus");
  });

  afterEach(async () => {
    mock.restore();
    await rm(testDir, { recursive: true, force: true });
  });

  test("returns true when all extension modules are deployed and all anti-affinity adjustments are done", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);
    await writeAntiAffinityModuleYamls(regionPath, false, mockContext);

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(true);
  });

  test("returns false when any extension module is not yet deployed", async () => {
    getModuleStatusMock.mockImplementation(async ({ module }) => {
      if ((module as MODULES) === MODULES.KUBE_RELOADER) {
        return { ...SUCCESS_STATUS, deploy_status: "undeployed" as const };
      }
      return SUCCESS_STATUS;
    });
    await writeAntiAffinityModuleYamls(regionPath, false, mockContext);

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(false);
  });

  test("returns false when kube_reloader is deployed but a sibling extension module failed", async () => {
    getModuleStatusMock.mockImplementation(async ({ module }) => {
      if ((module as MODULES) === MODULES.KUBE_CLOUDNATIVE_PG) {
        return { ...SUCCESS_STATUS, deploy_status: "error" as const };
      }
      return SUCCESS_STATUS;
    });
    await writeAntiAffinityModuleYamls(regionPath, false, mockContext);

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(false);
  });

  test("returns false when anti-affinity adjustments have not been applied (bootstrap_mode_enabled still true)", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);
    await writeAntiAffinityModuleYamls(regionPath, true, mockContext);

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(false);
  });

  test("returns true when module.yaml files are missing for anti-affinity modules", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);
    // No module.yaml files created — absence is not treated as a failure

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(true);
  });

  test("returns true when module.yaml exists but has no bootstrap_mode_enabled field", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);

    for (const module of ANTI_AFFINITY_MODULES) {
      const moduleDir = join(regionPath, module);
      await mkdir(moduleDir, { recursive: true });
      await writeYAMLFile({
        context: mockContext,
        filePath: join(moduleDir, "module.yaml"),
        values: { some_other_field: "value" },
      });
    }

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(true);
  });

  test("returns false when only some anti-affinity adjustments are done", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);

    for (const module of ANTI_AFFINITY_MODULES) {
      const moduleDir = join(regionPath, module);
      await mkdir(moduleDir, { recursive: true });
      await writeYAMLFile({
        context: mockContext,
        filePath: join(moduleDir, "module.yaml"),
        values: {
          extra_inputs: {
            bootstrap_mode_enabled: module === MODULES.KUBE_VAULT ? true : false,
          },
        },
      });
    }

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(false);
  });

  test("queries getModuleStatus for all extension modules", async () => {
    getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);
    await writeAntiAffinityModuleYamls(regionPath, false, mockContext);

    await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    for (const module of ALL_EXTENSION_MODULES) {
      expect(getModuleStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          module,
          environment: "production",
          region: "us-east-1",
        })
      );
    }
  });

  test("returns false when no cluster infrastructure exists at all", async () => {
    getModuleStatusMock.mockResolvedValue({
      ...SUCCESS_STATUS,
      module_exists: false,
      deploy_status: "undeployed" as const,
    });

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
    });

    expect(result).toBe(false);
  });

  test("propagates errors from getModuleStatus", async () => {
    const testError = new Error("Terragrunt status check failed");
    getModuleStatusMock.mockRejectedValue(testError);

    await expect(
      isClusterDeployed({
        context: mockContext,
        environment: "production",
        region: "us-east-1",
      })
    ).rejects.toThrow("Terragrunt status check failed");
  });

  test("handles different environment and region combinations", async () => {
    const testCases = [
      { environment: "development", region: "us-west-1" },
      { environment: "staging", region: "ap-northeast-1" },
    ];

    for (const testCase of testCases) {
      const casePath = join(testDir, testCase.environment, testCase.region);
      await mkdir(casePath, { recursive: true });
      await writeAntiAffinityModuleYamls(casePath, false, {
        ...mockContext,
        devshellConfig: {
          ...(mockContext.devshellConfig as object),
          environments_dir: testDir,
        },
      } as unknown as PanfactumContext);

      getModuleStatusMock.mockResolvedValue(SUCCESS_STATUS);

      const result = await isClusterDeployed({
        context: {
          ...mockContext,
          devshellConfig: {
            ...(mockContext.devshellConfig as object),
            environments_dir: testDir,
          },
        } as unknown as PanfactumContext,
        environment: testCase.environment,
        region: testCase.region,
      });

      expect(result).toBe(true);
    }
  });
});
