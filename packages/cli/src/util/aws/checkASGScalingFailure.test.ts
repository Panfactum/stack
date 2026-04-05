// This file contains comprehensive unit tests for the checkASGScalingFailure function
// It tests detection of ASG scaling failures with various status codes and messages

import { DescribeScalingActivitiesCommand } from "@aws-sdk/client-auto-scaling";
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import * as getAutoScalingClientModule from "@/util/aws/clients/getAutoScalingClient";
import { CLIError } from "@/util/error/error";
import { checkASGScalingFailure } from "./checkASGScalingFailure";
import type { PanfactumContext } from "@/util/context/context";

interface IMockAutoScalingClient {
  send: ReturnType<typeof mock>;
}

describe("checkASGScalingFailure", () => {
  let mockAutoScalingClient: IMockAutoScalingClient;
  let getAutoScalingClientSpy: ReturnType<typeof spyOn<typeof getAutoScalingClientModule, "getAutoScalingClient">>;
  let mockContext: PanfactumContext;

  beforeEach(() => {
    // Create mock AutoScaling client
    mockAutoScalingClient = {
      send: mock(() => {})
    };

    // Spy on getAutoScalingClient
    getAutoScalingClientSpy = spyOn(getAutoScalingClientModule, "getAutoScalingClient");
    getAutoScalingClientSpy.mockResolvedValue(mockAutoScalingClient as unknown as Awaited<ReturnType<typeof getAutoScalingClientModule.getAutoScalingClient>>);

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

  test("returns silently when no activities exist", async () => {
    mockAutoScalingClient.send.mockResolvedValue({ Activities: [] });

    await expect(
      checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).resolves.toBeUndefined();
  });

  test("returns silently when latest activity succeeded", async () => {
    mockAutoScalingClient.send.mockResolvedValue({
      Activities: [{ StatusCode: "Successful", StatusMessage: "Successfully launched 1 instance(s)." }]
    });

    await expect(
      checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).resolves.toBeUndefined();
  });

  test("returns silently when latest activity is in progress", async () => {
    mockAutoScalingClient.send.mockResolvedValue({
      Activities: [{ StatusCode: "InProgress", StatusMessage: "Launching a new EC2 instance." }]
    });

    await expect(
      checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).resolves.toBeUndefined();
  });

  test("throws CLIError with capacity message when StatusMessage contains 'insufficient capacity'", async () => {
    mockAutoScalingClient.send.mockResolvedValue({
      Activities: [{
        StatusCode: "Failed",
        StatusMessage: "We currently do not have sufficient t4g.nano capacity in the Availability Zone you requested (us-east-1a)."
      }]
    });

    try {
      await checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("capacity");
      expect((error as CLIError).message).toContain("Wait a few minutes and try again, or try a different region.");
    }
  });

  test("throws CLIError with capacity message when StatusMessage contains 'could not find enough available capacity'", async () => {
    mockAutoScalingClient.send.mockResolvedValue({
      Activities: [{
        StatusCode: "Failed",
        StatusMessage: "We could not find enough available capacity in the specified Availability Zone(s)."
      }]
    });

    try {
      await checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("capacity");
      expect((error as CLIError).message).toContain("Wait a few minutes and try again, or try a different region.");
    }
  });

  test("throws CLIError with generic message for non-capacity failures", async () => {
    mockAutoScalingClient.send.mockResolvedValue({
      Activities: [{
        StatusCode: "Failed",
        StatusMessage: "Invalid security group sg-12345"
      }]
    });

    try {
      await checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).not.toContain("Wait a few minutes and try again, or try a different region.");
    }
  });

  test("sends DescribeScalingActivitiesCommand with correct ASG name and MaxRecords", async () => {
    mockAutoScalingClient.send.mockResolvedValue({ Activities: [] });

    await checkASGScalingFailure({
      asg: "my-application-asg",
      awsProfile: "test-profile",
      awsRegion: "us-east-1",
      context: mockContext
    });

    const sentCommand = mockAutoScalingClient.send.mock.calls[0]?.[0] as DescribeScalingActivitiesCommand;
    expect(sentCommand).toBeInstanceOf(DescribeScalingActivitiesCommand);
    expect(sentCommand.input).toMatchInlineSnapshot(`
      {
        "AutoScalingGroupName": "my-application-asg",
        "MaxRecords": 1,
      }
    `);
  });

  test("throws CLIError when DescribeScalingActivities API call fails", async () => {
    const originalError = new Error("AWS API Error");
    mockAutoScalingClient.send.mockRejectedValue(originalError);

    try {
      await checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
    }
  });

  test("handles undefined Activities array", async () => {
    mockAutoScalingClient.send.mockResolvedValue({});

    await expect(
      checkASGScalingFailure({
        asg: "test-asg",
        awsProfile: "test-profile",
        awsRegion: "us-east-1",
        context: mockContext
      })
    ).resolves.toBeUndefined();
  });
});
