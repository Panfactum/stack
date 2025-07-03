// Tests for isBastionDeployed utility function
// Verifies bastion host deployment status checking

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { MODULES } from "@/util/terragrunt/constants";
import * as getModuleStatusModule from "@/util/terragrunt/getModuleStatus";
import { isBastionDeployed } from "./isBastionDeployed";
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

describe("isBastionDeployed", () => {
  beforeEach(() => {
    getModuleStatusMock = spyOn(getModuleStatusModule, "getModuleStatus");
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns true when bastion deployment status is success", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isBastionDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1"
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "production",
      region: "us-east-1",
      module: MODULES.KUBE_BASTION
    });
  });

  test("returns false when bastion deployment status is not success", async () => {
    const nonSuccessStatuses = ["undeployed", "error", "running"] as const;

    for (const status of nonSuccessStatuses) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: status
      });

      const result = await isBastionDeployed({
        context: mockContext,
        environment: "production",
        region: "us-east-1"
      });

      expect(result).toBe(false);
    }
  });

  test("returns false when bastion is not deployed", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "undeployed"
    });

    const result = await isBastionDeployed({
      context: mockContext,
      environment: "staging",
      region: "us-west-2"
    });

    expect(result).toBe(false);
  });

  test("handles different environment and region combinations", async () => {
    const testCases = [
      { environment: "development", region: "eu-west-1" },
      { environment: "staging", region: "ap-southeast-2" },
      { environment: "production", region: "us-east-1" }
    ];

    for (const testCase of testCases) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: "success"
      });

      const result = await isBastionDeployed({
        context: mockContext,
        environment: testCase.environment,
        region: testCase.region
      });

      expect(result).toBe(true);
      expect(getModuleStatusMock).toHaveBeenCalledWith({
        context: mockContext,
        environment: testCase.environment,
        region: testCase.region,
        module: MODULES.KUBE_BASTION
      });
    }
  });

  test("propagates errors from getModuleStatus", async () => {
    const testError = new Error("Failed to get module status");
    getModuleStatusMock.mockRejectedValue(testError);

    await expect(
      isBastionDeployed({
        context: mockContext,
        environment: "production",
        region: "us-east-1"
      })
    ).rejects.toThrow("Failed to get module status");
  });

  test("uses correct module constant", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isBastionDeployed({
      context: mockContext,
      environment: "production",
      region: "us-east-1"
    });

    // Verify it uses the correct module constant
    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.KUBE_BASTION
      })
    );
  });

  test("handles empty string parameters", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isBastionDeployed({
      context: mockContext,
      environment: "",
      region: ""
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "",
      region: "",
      module: MODULES.KUBE_BASTION
    });
  });
});