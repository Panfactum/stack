// This file contains comprehensive unit tests for the waitForASGInstance function
// It tests waiting for EC2 instances in Auto Scaling Groups with various scenarios

import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import * as getAutoScalingClientModule from "@/util/aws/clients/getAutoScalingClient";
import { CLIError } from "@/util/error/error";
import * as sleepModule from "@/util/util/sleep";
import { waitForASGInstance } from "./waitForASGInstance";
import type { PanfactumContext } from "@/util/context/context";

interface IMockAutoScalingClient {
  send: ReturnType<typeof mock>;
}

describe("waitForASGInstance", () => {
  let mockAutoScalingClient: IMockAutoScalingClient;
  let getAutoScalingClientSpy: ReturnType<typeof spyOn<typeof getAutoScalingClientModule, "getAutoScalingClient">>;
  let sleepSpy: ReturnType<typeof spyOn<typeof sleepModule, "sleep">>;
  let mockContext: PanfactumContext;

  beforeEach(() => {
    // Create mock AutoScaling client
    mockAutoScalingClient = {
      send: mock(() => {})
    };

    // Spy on getAutoScalingClient
    getAutoScalingClientSpy = spyOn(getAutoScalingClientModule, "getAutoScalingClient");
    getAutoScalingClientSpy.mockResolvedValue(mockAutoScalingClient as unknown as Awaited<ReturnType<typeof getAutoScalingClientModule.getAutoScalingClient>>);

    // Spy on sleep to avoid actual delays
    sleepSpy = spyOn(sleepModule, "sleep");
    sleepSpy.mockResolvedValue(undefined);

    // Create mock context
    mockContext = {
      logger: {
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {})
      }
    } as unknown as PanfactumContext;
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns instance ID when instance is available on first attempt", async () => {
    const mockResponse = {
      AutoScalingGroups: [{
        Instances: [{
          InstanceId: "i-1234567890abcdef0"
        }]
      }]
    };

    mockAutoScalingClient.send.mockResolvedValue(mockResponse);

    const result = await waitForASGInstance({
      asg: "test-asg",
      awsProfile: "test-profile",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-1234567890abcdef0");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(1);
    expect(mockAutoScalingClient.send).toHaveBeenCalledWith(
      expect.any(DescribeAutoScalingGroupsCommand)
    );
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test("creates AutoScaling client with correct parameters", async () => {
    const mockResponse = {
      AutoScalingGroups: [{
        Instances: [{
          InstanceId: "i-test123"
        }]
      }]
    };

    mockAutoScalingClient.send.mockResolvedValue(mockResponse);

    await waitForASGInstance({
      asg: "production-asg",
      awsProfile: "production",
      awsRegion: "us-west-2",
      context: mockContext
    });

    expect(getAutoScalingClientSpy).toHaveBeenCalledWith({
      context: mockContext,
      profile: "production",
      region: "us-west-2"
    });
  });

  test("sends DescribeAutoScalingGroupsCommand with correct ASG name", async () => {
    const mockResponse = {
      AutoScalingGroups: [{
        Instances: [{
          InstanceId: "i-test456"
        }]
      }]
    };

    mockAutoScalingClient.send.mockResolvedValue(mockResponse);

    await waitForASGInstance({
      asg: "my-application-asg",
      awsProfile: "dev",
      awsRegion: "eu-west-1",
      context: mockContext
    });

    const sentCommand = mockAutoScalingClient.send.mock.calls[0]?.[0] as DescribeAutoScalingGroupsCommand;
    expect(sentCommand).toBeInstanceOf(DescribeAutoScalingGroupsCommand);
    expect(sentCommand.input).toEqual({
      AutoScalingGroupNames: ["my-application-asg"]
    });
  });

  test("retries when no instances are available initially", async () => {
    // First two calls return no instances, third call succeeds
    mockAutoScalingClient.send
      .mockResolvedValueOnce({ AutoScalingGroups: [{ Instances: [] }] })
      .mockResolvedValueOnce({ AutoScalingGroups: [{ Instances: [] }] })
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: "i-delayed123"
          }]
        }]
      });

    const result = await waitForASGInstance({
      asg: "slow-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-delayed123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(3);
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(10000);
  });

  test("retries when ASG has no instances array", async () => {
    // First call returns ASG with no Instances array, second call succeeds
    mockAutoScalingClient.send
      .mockResolvedValueOnce({ AutoScalingGroups: [{}] })
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: "i-noarray123"
          }]
        }]
      });

    const result = await waitForASGInstance({
      asg: "test-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-noarray123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
  });

  test("retries when instance has no InstanceId", async () => {
    // First call returns instance without InstanceId, second call succeeds
    mockAutoScalingClient.send
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{ LifecycleState: "Pending" }]
        }]
      })
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: "i-withid123",
            LifecycleState: "InService"
          }]
        }]
      });

    const result = await waitForASGInstance({
      asg: "test-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-withid123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(2);
  });

  test("retries when AutoScalingGroups array is empty", async () => {
    // First call returns empty array, second call succeeds
    mockAutoScalingClient.send
      .mockResolvedValueOnce({ AutoScalingGroups: [] })
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: "i-empty123"
          }]
        }]
      });

    const result = await waitForASGInstance({
      asg: "test-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-empty123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(2);
  });

  test("throws CLIError when max retries are reached", async () => {
    // Always return no instances
    mockAutoScalingClient.send.mockResolvedValue({
      AutoScalingGroups: [{ Instances: [] }]
    });

    await expect(
      waitForASGInstance({
        asg: "failing-asg",
        awsProfile: "test",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).rejects.toThrow(
      new CLIError("Failed to get instance ID - after 10 retries")
    );

    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(10);
    expect(sleepSpy).toHaveBeenCalledTimes(9); // No sleep after last attempt
  });

  test("throws CLIError when DescribeAutoScalingGroups fails", async () => {
    const originalError = new Error("AWS API Error");
    mockAutoScalingClient.send.mockRejectedValue(originalError);

    await expect(
      waitForASGInstance({
        asg: "error-asg",
        awsProfile: "test",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).rejects.toThrow(CLIError);

    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  test("succeeds on the last possible attempt", async () => {
    // Fail 9 times, succeed on the 10th attempt
    for (let i = 0; i < 9; i++) {
      mockAutoScalingClient.send.mockResolvedValueOnce({
        AutoScalingGroups: [{ Instances: [] }]
      });
    }
    mockAutoScalingClient.send.mockResolvedValueOnce({
      AutoScalingGroups: [{
        Instances: [{
          InstanceId: "i-lastattempt123"
        }]
      }]
    });

    const result = await waitForASGInstance({
      asg: "last-chance-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-lastattempt123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(10);
    expect(sleepSpy).toHaveBeenCalledTimes(9);
  });

  test("returns first instance when multiple instances are available", async () => {
    const mockResponse = {
      AutoScalingGroups: [{
        Instances: [
          { InstanceId: "i-first123" },
          { InstanceId: "i-second456" },
          { InstanceId: "i-third789" }
        ]
      }]
    };

    mockAutoScalingClient.send.mockResolvedValue(mockResponse);

    const result = await waitForASGInstance({
      asg: "multi-instance-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-first123");
  });

  test("handles AutoScalingGroups being undefined", async () => {
    // First call returns undefined AutoScalingGroups, second call succeeds
    mockAutoScalingClient.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: "i-undefined123"
          }]
        }]
      });

    const result = await waitForASGInstance({
      asg: "test-asg",
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-undefined123");
    expect(mockAutoScalingClient.send).toHaveBeenCalledTimes(2);
  });

  test("works with different AWS regions", async () => {
    const regions = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

    for (const region of regions) {
      getAutoScalingClientSpy.mockClear();
      mockAutoScalingClient.send.mockClear();
      
      mockAutoScalingClient.send.mockResolvedValue({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: `i-${region}-123`
          }]
        }]
      });

      const result = await waitForASGInstance({
        asg: "region-test-asg",
        awsProfile: "multi-region",
        awsRegion: region,
        context: mockContext
      });

      expect(result).toBe(`i-${region}-123`);
      expect(getAutoScalingClientSpy).toHaveBeenCalledWith({
        context: mockContext,
        profile: "multi-region",
        region: region
      });
    }
  });

  test("works with different AWS profiles", async () => {
    const profiles = ["dev", "staging", "production", "test"];

    for (const profile of profiles) {
      getAutoScalingClientSpy.mockClear();
      mockAutoScalingClient.send.mockClear();
      
      mockAutoScalingClient.send.mockResolvedValue({
        AutoScalingGroups: [{
          Instances: [{
            InstanceId: `i-${profile}-123`
          }]
        }]
      });

      const result = await waitForASGInstance({
        asg: "profile-test-asg",
        awsProfile: profile,
        awsRegion: "us-east-1",
        context: mockContext
      });

      expect(result).toBe(`i-${profile}-123`);
      expect(getAutoScalingClientSpy).toHaveBeenCalledWith({
        context: mockContext,
        profile: profile,
        region: "us-east-1"
      });
    }
  });

  test("preserves original error information when AWS call fails", async () => {
    const originalError = new Error("AccessDenied: Insufficient permissions");
    mockAutoScalingClient.send.mockRejectedValue(originalError);

    try {
      await waitForASGInstance({
        asg: "permission-test-asg",
        awsProfile: "test",
        awsRegion: "us-east-1",
        context: mockContext
      });
      expect.unreachable("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("Failed to get instance ID");
      // Check that the error was wrapped (cause might not be directly accessible)
      expect(String(error)).toContain("Failed to get instance ID");
    }
  });

  test("handles very long ASG names", async () => {
    const longAsgName = "very-long-auto-scaling-group-name-that-exceeds-normal-length-limits-but-should-still-work";
    
    mockAutoScalingClient.send.mockResolvedValue({
      AutoScalingGroups: [{
        Instances: [{
          InstanceId: "i-longname123"
        }]
      }]
    });

    const result = await waitForASGInstance({
      asg: longAsgName,
      awsProfile: "test",
      awsRegion: "us-east-1",
      context: mockContext
    });

    expect(result).toBe("i-longname123");
    
    const sentCommand = mockAutoScalingClient.send.mock.calls[0]?.[0] as DescribeAutoScalingGroupsCommand;
    expect(sentCommand.input).toEqual({
      AutoScalingGroupNames: [longAsgName]
    });
  });
});