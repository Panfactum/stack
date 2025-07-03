// Tests for isClusterDeployed utility function
// Verifies Kubernetes cluster deployment status checking

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { MODULES } from "@/util/terragrunt/constants";
import * as getModuleStatusModule from "@/util/terragrunt/getModuleStatus";
import { isClusterDeployed } from "./isClusterDeployed";
import type { PanfactumContext } from "@/util/context/context";

let getModuleStatusMock: ReturnType<typeof spyOn<typeof getModuleStatusModule, "getModuleStatus">>;

const mockContext = {
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
  }
} as unknown as PanfactumContext;

describe("isClusterDeployed", () => {
  beforeEach(() => {
    getModuleStatusMock = spyOn(getModuleStatusModule, "getModuleStatus");
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns true when cluster deployment status is success", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isClusterDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1"
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
      module: MODULES.KUBE_RELOADER
    });
  });

  test("returns false when cluster deployment status is not success", async () => {
    const nonSuccessStatuses = ["undeployed", "running", "error"] as const;

    for (const status of nonSuccessStatuses) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: status
      });

      const result = await isClusterDeployed({
        context: mockContext,
        environment: "production",
        region: "us-east-1"
      });

      expect(result).toBe(false);
    }
  });

  test("uses KUBE_RELOADER module as cluster deployment marker", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isClusterDeployed({
      context: mockContext,
      environment: "staging",
      region: "eu-west-1"
    });

    // Verify it uses the correct module constant for cluster detection
    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.KUBE_RELOADER
      })
    );
  });

  test("handles various environment and region combinations", async () => {
    const testCases = [
      { environment: "development", region: "us-west-1" },
      { environment: "staging", region: "ap-northeast-1" },
      { environment: "production", region: "eu-central-1" }
    ];

    for (const testCase of testCases) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: "success"
      });

      const result = await isClusterDeployed({
        context: mockContext,
        environment: testCase.environment,
        region: testCase.region
      });

      expect(result).toBe(true);
      expect(getModuleStatusMock).toHaveBeenCalledWith({
        context: mockContext,
        environment: testCase.environment,
        region: testCase.region,
        module: MODULES.KUBE_RELOADER
      });
    }
  });

  test("propagates errors from getModuleStatus", async () => {
    const testError = new Error("Terragrunt status check failed");
    getModuleStatusMock.mockRejectedValue(testError);

    await expect(
      isClusterDeployed({
        context: mockContext,
        environment: "production",
        region: "us-east-1"
      })
    ).rejects.toThrow("Terragrunt status check failed");
  });
});