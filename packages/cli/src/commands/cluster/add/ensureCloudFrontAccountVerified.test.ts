// This file contains unit tests for the ensureCloudFrontAccountVerified pre-flight check
// It exercises distribution short-circuiting, OAI probing, error classification, and
// cleanup behavior using a single mocked CloudFront client whose `send` implementation
// dispatches based on the constructor name of the incoming command.

import {
  CreateCloudFrontOriginAccessIdentityCommand,
  DeleteCloudFrontOriginAccessIdentityCommand,
  ListDistributionsCommand,
} from "@aws-sdk/client-cloudfront";
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import * as getCloudFrontClientModule from "@/util/aws/clients/getCloudFrontClient";
import { CLIError } from "@/util/error/error";
import { ensureCloudFrontAccountVerified } from "./ensureCloudFrontAccountVerified";
import type { PanfactumContext } from "@/util/context/context";

interface IMockCloudFrontClient {
  send: ReturnType<typeof mock>;
}

interface IMockResponses {
  list?: () => Promise<unknown>;
  create?: () => Promise<unknown>;
  delete?: () => Promise<unknown>;
}

/**
 * Builds a `send` mock that dispatches based on the command constructor name.
 *
 * @internal
 */
function buildSendMock(responses: IMockResponses): ReturnType<typeof mock> {
  return mock((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor.name;
    if (name === ListDistributionsCommand.name) {
      if (responses.list) {
        return responses.list();
      }
      return Promise.resolve({ DistributionList: { Items: [] } });
    }
    if (name === CreateCloudFrontOriginAccessIdentityCommand.name) {
      if (responses.create) {
        return responses.create();
      }
      return Promise.resolve({
        CloudFrontOriginAccessIdentity: { Id: "OAI-DEFAULT" },
        ETag: "etag-default",
      });
    }
    if (name === DeleteCloudFrontOriginAccessIdentityCommand.name) {
      if (responses.delete) {
        return responses.delete();
      }
      return Promise.resolve({});
    }
    return Promise.resolve({});
  });
}

describe("ensureCloudFrontAccountVerified", () => {
  let mockCloudFrontClient: IMockCloudFrontClient;
  let getCloudFrontClientSpy: ReturnType<
    typeof spyOn<typeof getCloudFrontClientModule, "getCloudFrontClient">
  >;
  let mockContext: PanfactumContext;

  beforeEach(() => {
    mockCloudFrontClient = {
      send: buildSendMock({}),
    };

    getCloudFrontClientSpy = spyOn(
      getCloudFrontClientModule,
      "getCloudFrontClient"
    );
    getCloudFrontClientSpy.mockResolvedValue(
      mockCloudFrontClient as unknown as Awaited<
        ReturnType<typeof getCloudFrontClientModule.getCloudFrontClient>
      >
    );

    mockContext = {
      logger: {
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
      },
    } as unknown as PanfactumContext;
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns immediately when the account already has distributions", async () => {
    mockCloudFrontClient.send = buildSendMock({
      list: () =>
        Promise.resolve({
          DistributionList: {
            Items: [{ Id: "EXISTING" }],
          },
        }),
      create: () => {
        throw new Error("create should never be called when distributions exist");
      },
      delete: () => {
        throw new Error("delete should never be called when distributions exist");
      },
    });

    await expect(
      ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      })
    ).resolves.toBeUndefined();

    const sentCommands = mockCloudFrontClient.send.mock.calls.map(
      (call) => (call[0] as { constructor: { name: string } }).constructor.name
    );
    expect(sentCommands).toEqual([ListDistributionsCommand.name]);
  });

  test("runs OAI probe and cleans up when no distributions exist", async () => {
    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.resolve({ DistributionList: { Items: [] } }),
      create: () =>
        Promise.resolve({
          CloudFrontOriginAccessIdentity: { Id: "X" },
          ETag: "abc",
        }),
      delete: () => Promise.resolve({}),
    });

    await expect(
      ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      })
    ).resolves.toBeUndefined();

    const calls = mockCloudFrontClient.send.mock.calls;
    expect(calls).toHaveLength(3);

    const listCall = calls[0]?.[0] as ListDistributionsCommand;
    expect(listCall).toBeInstanceOf(ListDistributionsCommand);

    const createCall = calls[1]?.[0] as CreateCloudFrontOriginAccessIdentityCommand;
    expect(createCall).toBeInstanceOf(CreateCloudFrontOriginAccessIdentityCommand);

    const deleteCall = calls[2]?.[0] as DeleteCloudFrontOriginAccessIdentityCommand;
    expect(deleteCall).toBeInstanceOf(DeleteCloudFrontOriginAccessIdentityCommand);
    expect(deleteCall.input).toMatchInlineSnapshot(`
      {
        "Id": "X",
        "IfMatch": "abc",
      }
    `);
  });

  test("throws verification CLIError on 403 + AccessDenied + 'must be verified'", async () => {
    const verificationError = Object.assign(
      new Error(
        "Your account must be verified before you can add new CloudFront resources. To verify your account, please contact AWS Support."
      ),
      {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }
    );

    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.resolve({ DistributionList: { Items: [] } }),
      create: () => Promise.reject(verificationError),
    });

    try {
      await ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("has not been verified");
      expect((error as CLIError).message).toContain("console.aws.amazon.com/support");
    }
  });

  test("throws permissions CLIError on generic 403 + AccessDenied", async () => {
    const permissionsError = Object.assign(
      new Error(
        "User: arn:aws:iam::123456789012:user/test is not authorized to perform: cloudfront:CreateCloudFrontOriginAccessIdentity"
      ),
      {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }
    );

    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.resolve({ DistributionList: { Items: [] } }),
      create: () => Promise.reject(permissionsError),
    });

    try {
      await ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      });
      expect.unreachable("Should have thrown a CLIError");
    } catch (error) {
      expect(error).toBeInstanceOf(CLIError);
      expect((error as CLIError).message).toContain("CloudFront permissions");
      expect((error as CLIError).message).toContain(
        "cloudfront:CreateCloudFrontOriginAccessIdentity"
      );
    }
  });

  test("swallows network errors and returns", async () => {
    const networkError = new TypeError("fetch failed");

    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.resolve({ DistributionList: { Items: [] } }),
      create: () => Promise.reject(networkError),
    });

    await expect(
      ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      })
    ).resolves.toBeUndefined();

    const debugMock = mockContext.logger.debug as unknown as ReturnType<typeof mock>;
    expect(debugMock).toHaveBeenCalled();
  });

  test("falls through to probe when ListDistributions errors", async () => {
    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.reject(new Error("list blew up")),
      create: () =>
        Promise.resolve({
          CloudFrontOriginAccessIdentity: { Id: "X" },
          ETag: "abc",
        }),
      delete: () => Promise.resolve({}),
    });

    await expect(
      ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      })
    ).resolves.toBeUndefined();

    const sentCommands = mockCloudFrontClient.send.mock.calls.map(
      (call) => (call[0] as { constructor: { name: string } }).constructor.name
    );
    expect(sentCommands).toEqual([
      ListDistributionsCommand.name,
      CreateCloudFrontOriginAccessIdentityCommand.name,
      DeleteCloudFrontOriginAccessIdentityCommand.name,
    ]);
  });

  test("warns but does not throw when cleanup fails", async () => {
    mockCloudFrontClient.send = buildSendMock({
      list: () => Promise.resolve({ DistributionList: { Items: [] } }),
      create: () =>
        Promise.resolve({
          CloudFrontOriginAccessIdentity: { Id: "OAI-LEAKED" },
          ETag: "etag-leaked",
        }),
      delete: () => Promise.reject(new Error("delete failed")),
    });

    await expect(
      ensureCloudFrontAccountVerified({
        context: mockContext,
        profile: "test-profile",
      })
    ).resolves.toBeUndefined();

    const warnMock = mockContext.logger.warn as unknown as ReturnType<typeof mock>;
    expect(warnMock).toHaveBeenCalled();
    const warnArgs = warnMock.mock.calls[0];
    expect(warnArgs?.[0]).toContain("OAI-LEAKED");
  });
});
