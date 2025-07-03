// This file contains unit tests for the TasklistBuilder class
// It focuses on type safety, context transformations, and rollback mechanisms

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { TasklistBuilder } from "./TasklistBuilder";
import type { PanfactumTaskWrapper } from "./types";
import type { PanfactumContext } from "@/util/context/context";

describe("TasklistBuilder", () => {
  // Store original console methods
  let originalLog: typeof globalThis.console.log;
  let originalError: typeof globalThis.console.error;
  let originalWarn: typeof globalThis.console.warn;
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;

  beforeAll(() => {
    // Save original methods
    originalLog = globalThis.console.log;
    originalError = globalThis.console.error;
    originalWarn = globalThis.console.warn;
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;

    // Mock console methods to suppress output
    globalThis.console.log = () => { };
    globalThis.console.error = () => { };
    globalThis.console.warn = () => { };
    process.stdout.write = () => true;
    process.stderr.write = () => true;
  });

  afterAll(() => {
    // Restore original methods
    globalThis.console.log = originalLog;
    globalThis.console.error = originalError;
    globalThis.console.warn = originalWarn;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  test("should create builder with initial context", () => {
    interface IInitialContext {
      name: string;
      version: number;
    }

    const initialContext: IInitialContext = {
      name: "test-project",
      version: 1
    };

    const builder = new TasklistBuilder(initialContext);
    expect(builder).toBeDefined();

    // Test that we can call buildListr() without errors
    const listr = builder.buildListr({ silentRendererCondition: true });
    expect(listr).toBeDefined();
  });

  test("should handle basic context transformation with add()", async () => {
    interface IInitialContext {
      projectName: string;
    }

    interface IAddition1 {
      validated: boolean;
    }

    interface IAddition2 {
      projectPath: string;
    }

    const initialContext: IInitialContext = {
      projectName: "my-app"
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask("Validate project", async (ctx): Promise<IAddition1> => {
        expect(ctx.projectName).toBe("my-app");
        return { validated: true };
      })
      .addTask("Create directory", async (ctx): Promise<IAddition2> => {
        expect(ctx.projectName).toBe("my-app");
        expect(ctx.validated).toBe(true);
        return { projectPath: `/projects/${ctx.projectName}` };
      });

    const result = await builder.buildListr({ silentRendererCondition: true  }).run(builder.getInitialContext());

    expect(result).toMatchInlineSnapshot(`
      {
        "projectName": "my-app",
        "projectPath": "/projects/my-app",
        "validated": true,
      }
    `);
  });

  test("should handle side effects with add() without changing context type", async () => {
    interface ITestContext {
      data: string[];
    }

    const initialContext: ITestContext = {
      data: ["item1", "item2"]
    };

    let sideEffectExecuted = false;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Log data", async (ctx) => {
        expect(ctx.data).toEqual(["item1", "item2"]);
        sideEffectExecuted = true;
        // No return value - context remains unchanged
      })
      .addTask("Process data", async (ctx) => {
        expect(ctx.data).toEqual(["item1", "item2"]);
        return { processed: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(sideEffectExecuted).toBe(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "data": [
          "item1",
          "item2",
        ],
        "processed": true,
      }
    `);
  });

  test("should handle conditional tasks based on context state", async () => {
    interface ITestContext {
      hasPermissions: boolean;
    }

    const testCases = [
      { hasPermissions: true, expectBackup: true },
      { hasPermissions: false, expectBackup: false }
    ];

    for (const testCase of testCases) {
      const initialContext: ITestContext = {
        hasPermissions: testCase.hasPermissions
      };

      const builder = new TasklistBuilder(initialContext)
        .addTask(
          "Create backup",
          async () => ({ backupCreated: true }),
          { enabled: (ctx) => ctx.hasPermissions }
        );

      const result = await builder.buildListr({ silentRendererCondition: true  }).run(builder.getInitialContext());

      if (testCase.expectBackup) {
        expect(result).toMatchInlineSnapshot(`
          {
            "backupCreated": true,
            "hasPermissions": true,
          }
        `);
      } else {
        expect(result).toMatchInlineSnapshot(`
          {
            "hasPermissions": false,
          }
        `);
      }
    }
  });

  test("should handle void return types correctly", async () => {
    interface ITestContext {
      counter: number;
    }

    const initialContext: ITestContext = {
      counter: 0
    };

    let taskExecuted = false;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Task with void return", async (ctx) => {
        expect(ctx.counter).toBe(0);
        taskExecuted = true;
        // Explicitly return void
        return undefined;
      })
      .addTask("Task with number return", async (ctx) => {
        expect(ctx.counter).toBe(0);
        return { incremented: ctx.counter + 1 };
      });

    const result = await builder.buildListr({ silentRendererCondition: true  }).run(builder.getInitialContext());

    expect(taskExecuted).toBe(true);
    expect(result).toMatchInlineSnapshot(`
      {
        "counter": 0,
        "incremented": 1,
      }
    `);
  });

  test("should handle complex nested object context", async () => {
    interface IInitialContext {
      config: {
        database: {
          host: string;
          port: number;
        };
        features: string[];
      };
    }

    interface IDatabaseInfo {
      connectionString: string;
    }

    interface IDeploymentInfo {
      deployment: {
        timestamp: string;
        status: "success" | "failed";
      };
    }

    const initialContext: IInitialContext = {
      config: {
        database: {
          host: "localhost",
          port: 5432
        },
        features: ["auth", "api"]
      }
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask("Generate connection string", async (ctx): Promise<IDatabaseInfo> => {
        const { host, port } = ctx.config.database;
        return {
          connectionString: `postgresql://${host}:${port}/app`
        };
      })
      .addTask("Deploy application", async (ctx): Promise<IDeploymentInfo> => {
        expect(ctx.connectionString).toBe("postgresql://localhost:5432/app");
        return {
          deployment: {
            timestamp: "2024-01-01T00:00:00Z",
            status: "success"
          }
        };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result.config.database.host).toBe("localhost");
    expect(result.connectionString).toBe("postgresql://localhost:5432/app");
    expect(result.deployment.status).toBe("success");
  });

  test("should maintain immutable context operations", async () => {
    interface ITestContext {
      items: string[];
      metadata: { created: string };
    }

    const initialContext: ITestContext = {
      items: ["a", "b"],
      metadata: { created: "2024-01-01" }
    };

    // Keep reference to initial context to verify it's not mutated
    const originalItems = initialContext.items;
    const originalMetadata = initialContext.metadata;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Add item", async (ctx) => {
        // Verify we can read the original context
        expect(ctx.items).toEqual(["a", "b"]);

        // Return new data that should be merged
        return {
          items: [...ctx.items, "c"],
          newField: "added"
        };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    // Verify the result has the new data
    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.newField).toBe("added");
    expect(result.metadata.created).toBe("2024-01-01");

    // Verify the original context objects were not mutated
    expect(originalItems).toEqual(["a", "b"]);
    expect(originalMetadata.created).toBe("2024-01-01");
  });

  test("should handle task execution with PanfactumTaskWrapper", async () => {
    interface ITestContext {
      step: number;
    }

    const initialContext: ITestContext = {
      step: 1
    };

    let taskWrapperReceived: PanfactumTaskWrapper<ITestContext> | undefined;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Test task wrapper", async (ctx, task) => {
        taskWrapperReceived = task;
        expect(ctx.step).toBe(1);
        return { completed: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(taskWrapperReceived).toBeDefined();
    expect(result).toMatchInlineSnapshot(`
      {
        "completed": true,
        "step": 1,
      }
    `);
  });

  test("should handle multiple sequential context transformations", async () => {
    interface IInitialContext {
      id: string;
    }

    const initialContext: IInitialContext = {
      id: "user-123"
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask("Step 1", async (ctx) => {
        expect(ctx.id).toBe("user-123");
        return { step1: "completed" };
      })
      .addTask("Step 2", async (ctx) => {
        expect(ctx.id).toBe("user-123");
        expect(ctx.step1).toBe("completed");
        return { step2: "completed" };
      })
      .addTask("Step 3", async (ctx) => {
        expect(ctx.id).toBe("user-123");
        expect(ctx.step1).toBe("completed");
        expect(ctx.step2).toBe("completed");
        return { step3: "completed" };
      })
      .addTask("Final step", async (ctx) => {
        expect(ctx.id).toBe("user-123");
        expect(ctx.step1).toBe("completed");
        expect(ctx.step2).toBe("completed");
        expect(ctx.step3).toBe("completed");
        return { final: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result).toMatchInlineSnapshot(`
      {
        "final": true,
        "id": "user-123",
        "step1": "completed",
        "step2": "completed",
        "step3": "completed",
      }
    `);
  });

  test("should handle empty initial context", async () => {
    const initialContext: Record<string, unknown> = {};

    const builder = new TasklistBuilder(initialContext)
      .addTask("Add first property", async () => ({
        first: "value1"
      }))
      .addTask("Add second property", async (ctx) => {
        expect(ctx.first).toBe("value1");
        return { second: "value2" };
      });

    const result = await builder.buildListr({silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result).toMatchInlineSnapshot(`
      {
        "first": "value1",
        "second": "value2",
      }
    `);
  });

  test("should handle task errors and rollback execution", async () => {
    interface ITestContext {
      counter: number;
    }

    const initialContext: ITestContext = {
      counter: 0
    };

    let rollbackExecuted = false;
    let secondTaskReached = false;

    const builder = new TasklistBuilder(initialContext)
      .addTask("First task", async (ctx) => {
        expect(ctx.counter).toBe(0);
        return { firstCompleted: true };
      }, {
        rollback: async () => {
          rollbackExecuted = true;
        }
      })
      .addTask("Failing task", async (ctx) => {
        expect(ctx.firstCompleted).toBe(true);
        throw new Error("Task failed");
      })
      .addTask("Second task", async () => {
        secondTaskReached = true;
        return { secondCompleted: true };
      });

    try {
      await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());
      expect.unreachable("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Task failed");
    }

    expect(rollbackExecuted).toBe(true);
    expect(secondTaskReached).toBe(false);
  });

  test("should handle runTasks method with error wrapping", async () => {
    interface ITestContext {
      data: string;
    }

    const initialContext: ITestContext = {
      data: "test"
    };

    const mockContext = {
      logger: {
        write: () => { }
      }
    } as unknown as PanfactumContext;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Failing task", async () => {
        throw new Error("Original error");
      });

    try {
      await builder.runTasks({
        context: mockContext,
        errorMessage: "Custom error message"
      });
      expect.unreachable("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).toBe("Custom error message: Original error");
    }
  });

  test("should handle deep cloning in snapshots", async () => {
    interface ITestContext {
      nested: {
        array: number[];
        object: { value: string };
      };
    }

    const initialContext: ITestContext = {
      nested: {
        array: [1, 2, 3],
        object: { value: "original" }
      }
    };

    // Keep references to verify immutability
    const originalArray = initialContext.nested.array;
    const originalObject = initialContext.nested.object;

    let snapshotReceived: ITestContext | undefined;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Modify nested data", async (ctx) => {
        // Modify the context (this should not affect snapshots)
        ctx.nested.array.push(4);
        ctx.nested.object.value = "modified";
        return { modified: true };
      }, {
        rollback: async (ctx) => {
          snapshotReceived = ctx;
        }
      })
      .addTask("Failing task", async () => {
        throw new Error("Rollback test");
      });

    try {
      await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());
      expect.unreachable("Should have thrown an error");
    } catch {
      // Expected to fail
    }

    // Verify that rollback received a properly cloned snapshot
    expect(snapshotReceived).toBeDefined();
    expect(snapshotReceived?.nested.array).toEqual([1, 2, 3]);
    expect(snapshotReceived?.nested.object.value).toBe("original");

    // Verify original objects are still intact
    expect(originalArray).toEqual([1, 2, 3]);
    expect(originalObject.value).toBe("original");
  });

  test("should handle custom snapshot override", async () => {
    interface ITestContext {
      sensitive: string;
      public: string;
    }

    const initialContext: ITestContext = {
      sensitive: "secret",
      public: "visible"
    };

    let customSnapshotReceived: ITestContext | undefined;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Task with custom snapshot", async (ctx) => {
        expect(ctx.sensitive).toBe("secret");
        return { processed: true };
      }, {
        // Custom snapshot that excludes sensitive data
        snapshotOverride: (ctx) => ({
          sensitive: "[REDACTED]",
          public: ctx.public
        }),
        rollback: async (ctx) => {
          customSnapshotReceived = ctx;
        }
      })
      .addTask("Failing task", async () => {
        throw new Error("Test rollback");
      });

    try {
      await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());
      expect.unreachable("Should have thrown an error");
    } catch {
      // Expected to fail
    }

    expect(customSnapshotReceived).toBeDefined();
    expect(customSnapshotReceived?.sensitive).toBe("[REDACTED]");
    expect(customSnapshotReceived?.public).toBe("visible");
  });

  test("should handle multiple rollbacks in reverse order", async () => {
    interface ITestContext {
      step: number;
    }

    const initialContext: ITestContext = {
      step: 0
    };

    const rollbackOrder: string[] = [];

    const builder = new TasklistBuilder(initialContext)
      .addTask("Task 1", async (ctx) => {
        expect(ctx.step).toBe(0);
        return { task1: "completed" };
      }, {
        rollback: async () => {
          rollbackOrder.push("task1");
        }
      })
      .addTask("Task 2", async (ctx) => {
        expect(ctx.task1).toBe("completed");
        return { task2: "completed" };
      }, {
        rollback: async () => {
          rollbackOrder.push("task2");
        }
      })
      .addTask("Task 3", async (ctx) => {
        expect(ctx.task2).toBe("completed");
        return { task3: "completed" };
      }, {
        rollback: async () => {
          rollbackOrder.push("task3");
        }
      })
      .addTask("Failing task", async () => {
        throw new Error("Trigger rollback");
      });

    try {
      await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());
      expect.unreachable("Should have thrown an error");
    } catch {
      // Expected to fail
    }

    // Rollbacks should execute in reverse order (most recent first)
    expect(rollbackOrder).toEqual(["task3", "task2", "task1"]);
  });

  test("should handle subtasks with context inheritance", async () => {
    interface ITestContext {
      projectId: string;
    }

    const initialContext: ITestContext = {
      projectId: "proj-123"
    };

    const builder = new TasklistBuilder(initialContext)
      .addSubtasks("Deploy components", async (ctx, subBuilder) => {
        expect(ctx.projectId).toBe("proj-123");

        return subBuilder
          .addTask("Deploy database", async (subCtx) => {
            expect(subCtx.projectId).toBe("proj-123");
            return { dbUrl: `db://proj-${subCtx.projectId}` };
          })
          .addTask("Deploy API", async (subCtx) => {
            expect(subCtx.projectId).toBe("proj-123");
            expect(subCtx.dbUrl).toBe("db://proj-proj-123");
            return { apiUrl: `api://proj-${subCtx.projectId}` };
          })
          .addTask("Return deployment info", async (subCtx) => {
            return {
              deployment: {
                database: subCtx.dbUrl,
                api: subCtx.apiUrl
              }
            };
          });
      })
      .addTask("Verify deployment", async (ctx) => {
        expect(ctx.deployment).toBeDefined();
        expect(ctx.deployment.database).toBe("db://proj-proj-123");
        expect(ctx.deployment.api).toBe("api://proj-proj-123");
        return { verified: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result.projectId).toBe("proj-123");
    expect(result.deployment).toBeDefined();
    expect(result.verified).toBe(true);
  });


  test("should handle compile-time type checking scenarios", () => {
    // This test verifies that TypeScript compilation succeeds with proper type inference
    interface IInitialContext {
      userId: string;
    }

    const initialContext: IInitialContext = {
      userId: "user-456"
    };

    // Test type evolution through method chaining
    const builder = new TasklistBuilder(initialContext)
      .addTask("Fetch user", async (ctx) => {
        // ctx should have userId: string
        const userId: string = ctx.userId;
        expect(userId).toBe("user-456");
        return { user: { name: "John", email: "john@example.com" } };
      })
      .addTask("Check permissions", async (ctx) => {
        // ctx should have userId: string AND user: { name: string, email: string }
        const userName: string = ctx.user.name;
        const userEmail: string = ctx.user.email;
        expect(userName).toBe("John");
        expect(userEmail).toBe("john@example.com");
        return { hasAccess: true };
      })
      .addTask(
        "Grant access",
        async (ctx) => {
          const userId: string = ctx.userId;
          expect(userId).toBe("user-456");
          return { accessGranted: new Date() };
        },
        {
          enabled: (ctx) => {
            // ctx should have all previous properties
            const hasAccess: boolean = ctx.hasAccess;
            return hasAccess;
          }
        }
      )
      .addTask("Log activity", async (ctx) => {
        // ctx.accessGranted is optional since it comes from a conditional task
        const grantTime: Date | undefined = ctx.accessGranted;
        // Since hasAccess is true in this test, the Grant access task should have run
        expect(grantTime).toBeInstanceOf(Date);
        // No return - demonstrates side effect usage
      });

    // Verify the builder can be built (compile-time check)
    expect(builder.buildListr({ silentRendererCondition: true })).toBeDefined();
  });

  test("should handle optional properties from conditional tasks", async () => {
    interface ITestContext {
      shouldRunTask: boolean;
    }

    const initialContext: ITestContext = {
      shouldRunTask: false
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask(
        "Conditional task",
        async () => ({ conditionalData: "I might not exist" }),
        { enabled: (ctx) => ctx.shouldRunTask }
      )
      .addTask("Check conditional data", async (ctx) => {
        // TypeScript should know that conditionalData is optional
        // This should compile without errors
        if (ctx.conditionalData) {
          expect(ctx.conditionalData).toBe("I might not exist");
        } else {
          // This branch should execute since shouldRunTask is false
          expect(ctx.conditionalData).toBeUndefined();
        }
        return { checked: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result.shouldRunTask).toBe(false);
    expect(result.conditionalData).toBeUndefined();
    expect(result.checked).toBe(true);
  });

  test("should handle nested optional properties from conditional tasks", async () => {
    interface ITestContext {
      enableFeature: boolean;
    }

    const initialContext: ITestContext = {
      enableFeature: true
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask(
        "Add nested feature",
        async () => ({
          feature: {
            name: "Advanced Feature",
            config: {
              enabled: true,
              level: 5
            }
          }
        }),
        { enabled: (ctx) => ctx.enableFeature }
      )
      .addTask("Use feature", async (ctx) => {
        // All nested properties should be optional
        const featureName = ctx.feature?.name;
        const featureLevel = ctx.feature?.config?.level;

        if (ctx.enableFeature) {
          expect(featureName).toBe("Advanced Feature");
          expect(featureLevel).toBe(5);
        } else {
          expect(featureName).toBeUndefined();
          expect(featureLevel).toBeUndefined();
        }

        return { used: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result.enableFeature).toBe(true);
    expect(result.feature).toBeDefined();
    expect(result.feature?.name).toBe("Advanced Feature");
    expect(result.used).toBe(true);
  });

  test("should type-check that non-conditional task returns are required", () => {
    // This test verifies compile-time type checking
    interface ITestContext {
      base: string;
    }

    const initialContext: ITestContext = {
      base: "value"
    };

    // Test that non-conditional task returns are required
    const builder = new TasklistBuilder(initialContext)
      .addTask("Add required data", async () => ({
        requiredField: "always present"
      }))
      .addTask("Use required data", async (ctx) => {
        // This should compile without null checks since requiredField is always present
        const value: string = ctx.requiredField;
        expect(value).toBe("always present");
        return { done: true };
      });

    // Verify the builder can be built (compile-time check)
    expect(builder.buildListr({ silentRendererCondition: true })).toBeDefined();
  });

  test("should handle Date types correctly in conditional tasks", async () => {
    interface ITestContext {
      shouldAddDate: boolean;
    }

    const initialContext: ITestContext = {
      shouldAddDate: true
    };

    const builder = new TasklistBuilder(initialContext)
      .addTask(
        "Add date conditionally",
        async () => ({
          timestamp: new Date("2024-01-01"),
          metadata: {
            created: new Date("2024-01-02"),
            info: "test"
          }
        }),
        { enabled: (ctx) => ctx.shouldAddDate }
      )
      .addTask("Use date", async (ctx) => {
        // These should be typed as Date | undefined, not as partial Date objects
        if (ctx.timestamp) {
          expect(ctx.timestamp).toBeInstanceOf(Date);
          expect(ctx.timestamp.toISOString()).toBe("2024-01-01T00:00:00.000Z");
        }

        if (ctx.metadata?.created) {
          expect(ctx.metadata.created).toBeInstanceOf(Date);
          expect(ctx.metadata.created.toISOString()).toBe("2024-01-02T00:00:00.000Z");
        }

        return { verified: true };
      });

    const result = await builder.buildListr({ silentRendererCondition: true }).run(builder.getInitialContext());

    expect(result.shouldAddDate).toBe(true);
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.verified).toBe(true);
  });

  test("should handle runTasks with Listr options", async () => {
    interface ITestContext {
      step: number;
    }

    const initialContext: ITestContext = {
      step: 0
    };

    const mockContext = {
      logger: {
        write: () => { }
      }
    } as unknown as PanfactumContext;

    const builder = new TasklistBuilder(initialContext)
      .addTask("Step 1", async (ctx) => {
        expect(ctx.step).toBe(0);
        return { step: 1, completed: true };
      })
      .addTask("Step 2", async (ctx) => {
        expect(ctx.step).toBe(1);
        return { final: true };
      });

    const result = await builder.runTasks({
      context: mockContext,
      errorMessage: "Task failed",
      options: {
        silentRendererCondition: true,
        exitOnError: true,
        collectErrors: false
      }
    });

    expect(result.step).toBe(1);
    expect(result.completed).toBe(true);
    expect(result.final).toBe(true);
  });
});