// Tests for isEnvironmentDeployed utility function
// Verifies environment deployment status checking based on core AWS infrastructure

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { GLOBAL_REGION, MANAGEMENT_ENVIRONMENT, MODULES } from "@/util/terragrunt/constants";
import * as getModuleStatusModule from "@/util/terragrunt/getModuleStatus";
import { isEnvironmentDeployed } from "./isEnvironmentDeployed";
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

describe("isEnvironmentDeployed", () => {
  beforeEach(() => {
    getModuleStatusMock = spyOn(getModuleStatusModule, "getModuleStatus");
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns true when environment AWS account module is successfully deployed", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isEnvironmentDeployed({
      context: mockContext,
      environment: "production"
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "production",
      region: GLOBAL_REGION,
      module: MODULES.AWS_ACCOUNT
    });
  });

  test("returns false when environment AWS account module is not successfully deployed", async () => {
    const nonSuccessStatuses = ["undeployed", "running", "error"] as const;

    for (const status of nonSuccessStatuses) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: status
      });

      const result = await isEnvironmentDeployed({
        context: mockContext,
        environment: "staging"
      });

      expect(result).toBe(false);
    }
  });

  test("uses AWS organization module for management environment", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isEnvironmentDeployed({
      context: mockContext,
      environment: MANAGEMENT_ENVIRONMENT
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: MANAGEMENT_ENVIRONMENT,
      region: GLOBAL_REGION,
      module: MODULES.AWS_ORGANIZATION
    });
  });

  test("returns false when management environment AWS organization is not deployed", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "error"
    });

    const result = await isEnvironmentDeployed({
      context: mockContext,
      environment: MANAGEMENT_ENVIRONMENT
    });

    expect(result).toBe(false);
  });

  test("uses AWS account module for non-management environments", async () => {
    const testEnvironments = ["development", "staging", "production", "test", "custom-env"];

    for (const environment of testEnvironments) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: "success"
      });

      const result = await isEnvironmentDeployed({
        context: mockContext,
        environment
      });

      expect(result).toBe(true);
      expect(getModuleStatusMock).toHaveBeenCalledWith({
        context: mockContext,
        environment,
        region: GLOBAL_REGION,
        module: MODULES.AWS_ACCOUNT
      });
    }
  });

  test("always uses global region for status checks", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isEnvironmentDeployed({
      context: mockContext,
      environment: "test-env"
    });

    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: GLOBAL_REGION
      })
    );
  });

  test("handles various environment names correctly", async () => {
    const environmentNames = [
      "dev",
      "development", 
      "staging",
      "prod",
      "production",
      "test",
      "demo",
      "preview",
      "custom-environment-name",
      "env-with-numbers-123"
    ];

    for (const environment of environmentNames) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: "success"
      });

      const result = await isEnvironmentDeployed({
        context: mockContext,
        environment
      });

      expect(result).toBe(true);
      expect(getModuleStatusMock).toHaveBeenCalledWith({
        context: mockContext,
        environment,
        region: GLOBAL_REGION,
        module: MODULES.AWS_ACCOUNT
      });
    }
  });

  test("correctly distinguishes between management and regular environments", async () => {
    // Test management environment
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isEnvironmentDeployed({
      context: mockContext,
      environment: MANAGEMENT_ENVIRONMENT
    });

    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.AWS_ORGANIZATION
      })
    );

    // Reset mock
    getModuleStatusMock.mockClear();

    // Test regular environment
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isEnvironmentDeployed({
      context: mockContext,
      environment: "production"
    });

    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.AWS_ACCOUNT
      })
    );
  });

  test("handles empty environment name", async () => {
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    const result = await isEnvironmentDeployed({
      context: mockContext,
      environment: ""
    });

    expect(result).toBe(true);
    expect(getModuleStatusMock).toHaveBeenCalledWith({
      context: mockContext,
      environment: "",
      region: GLOBAL_REGION,
      module: MODULES.AWS_ACCOUNT
    });
  });

  test("propagates errors from getModuleStatus", async () => {
    const testError = new Error("Module status check failed");
    getModuleStatusMock.mockRejectedValue(testError);

    await expect(
      isEnvironmentDeployed({
        context: mockContext,
        environment: "production"
      })
    ).rejects.toThrow("Module status check failed");
  });

  test("uses correct module constants", async () => {
    // Verify the function uses the expected module constants
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isEnvironmentDeployed({
      context: mockContext,
      environment: "test"
    });

    // Verify it uses the AWS_ACCOUNT module constant for regular environments
    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.AWS_ACCOUNT
      })
    );

    getModuleStatusMock.mockClear();

    // Test management environment uses organization module
    getModuleStatusMock.mockResolvedValue({
      environment_exists: true,
      region_exists: true,
      module_exists: true,
      init_status: "success",
      deploy_status: "success"
    });

    await isEnvironmentDeployed({
      context: mockContext,
      environment: MANAGEMENT_ENVIRONMENT
    });

    expect(getModuleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: MODULES.AWS_ORGANIZATION
      })
    );
  });

  test("only considers success status as deployed", async () => {
    const allPossibleStatuses = [
      "success",
      "undeployed",
      "running",
      "error"
    ] as const;

    for (const status of allPossibleStatuses) {
      getModuleStatusMock.mockResolvedValue({
        environment_exists: true,
        region_exists: true,
        module_exists: true,
        init_status: "success",
        deploy_status: status
      });

      const result = await isEnvironmentDeployed({
        context: mockContext,
        environment: "test"
      });

      if (status === "success") {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    }
  });
});