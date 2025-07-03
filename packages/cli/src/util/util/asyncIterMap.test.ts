// Tests for asyncIterMap utility function
// Verifies concurrent async iterable mapping with order preservation

import { test, expect, describe } from "bun:test";
import { asyncIterMap } from "./asyncIterMap";

describe("asyncIterMap", () => {
  test("maps empty async iterable to empty array", async () => {
    async function* emptyIter() {
      // Empty generator
    }

    const result = await asyncIterMap(emptyIter(), async (x: number) => x * 2);
    
    expect(result).toEqual([]);
  });

  test("maps single item async iterable", async () => {
    async function* singleItem() {
      yield 42;
    }

    const result = await asyncIterMap(singleItem(), async (x: number) => x * 2);
    
    expect(result).toEqual([84]);
  });

  test("maps multiple items preserving order", async () => {
    async function* numbers() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }

    const result = await asyncIterMap(numbers(), async (x: number) => x * 2);
    
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  test("processes items concurrently with timing verification", async () => {
    const processingTimes: number[] = [];
    const startTime = Date.now();

    async function* delayedNumbers() {
      yield 10;
      yield 20;
      yield 30;
    }

    const result = await asyncIterMap(delayedNumbers(), async (x: number) => {
      // Each operation takes 100ms
      await new Promise(resolve => globalThis.setTimeout(resolve, 100));
      processingTimes.push(Date.now() - startTime);
      return x * 10;
    });

    const totalTime = Date.now() - startTime;
    
    expect(result).toEqual([100, 200, 300]);
    
    // If processed sequentially, it would take ~300ms
    // If processed concurrently, it should take ~100ms
    expect(totalTime).toBeLessThan(200); // Allow some buffer for timing
    
    // All operations should complete around the same time
    const timeDiff = Math.max(...processingTimes) - Math.min(...processingTimes);
    expect(timeDiff).toBeLessThan(50); // Should be very close together
  });

  test("maintains order despite varying async operation durations", async () => {
    async function* items() {
      yield { id: 1, delay: 300 };
      yield { id: 2, delay: 100 };
      yield { id: 3, delay: 200 };
      yield { id: 4, delay: 50 };
    }

    const result = await asyncIterMap(items(), async (item) => {
      await new Promise(resolve => globalThis.setTimeout(resolve, item.delay));
      return `processed-${item.id}`;
    });

    // Even though item 4 completes first (50ms), item 2 second (100ms), etc.
    // the result should maintain the original order
    expect(result).toEqual([
      "processed-1",
      "processed-2", 
      "processed-3",
      "processed-4"
    ]);
  });

  test("transforms different data types", async () => {
    async function* mixedData() {
      yield "hello";
      yield "world";
      yield "test";
    }

    const result = await asyncIterMap(mixedData(), async (str: string) => {
      return {
        original: str,
        length: str.length,
        uppercase: str.toUpperCase()
      };
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "length": 5,
          "original": "hello",
          "uppercase": "HELLO",
        },
        {
          "length": 5,
          "original": "world",
          "uppercase": "WORLD",
        },
        {
          "length": 4,
          "original": "test",
          "uppercase": "TEST",
        },
      ]
    `);
  });

  test("handles async generator with delays between yields", async () => {
    async function* slowGenerator() {
      yield 1;
      await new Promise(resolve => globalThis.setTimeout(resolve, 50));
      yield 2;
      await new Promise(resolve => globalThis.setTimeout(resolve, 50));
      yield 3;
    }

    const startTime = Date.now();
    const result = await asyncIterMap(slowGenerator(), async (x: number) => {
      // Processing is fast compared to generation
      await new Promise(resolve => globalThis.setTimeout(resolve, 10));
      return x * 100;
    });

    const totalTime = Date.now() - startTime;
    
    expect(result).toEqual([100, 200, 300]);
    
    // Should take at least the generator time (~100ms) but processing can be concurrent
    expect(totalTime).toBeGreaterThanOrEqual(90);
    expect(totalTime).toBeLessThan(200);
  });

  test("propagates errors from async function", async () => {
    async function* errorTestNumbers() {
      yield 1;
      yield 2;
      yield 3;
    }

    await expect(asyncIterMap(errorTestNumbers(), async (x: number) => {
      if (x === 2) {
        throw new Error(`Processing failed for ${x}`);
      }
      return x * 2;
    })).rejects.toThrow("Processing failed for 2");
  });

  test("propagates errors from async iterable", async () => {
    async function* faultyGenerator() {
      yield 1;
      yield 2;
      throw new Error("Generator failed");
    }

    await expect(asyncIterMap(faultyGenerator(), async (x: number) => {
      return x * 2;
    })).rejects.toThrow("Generator failed");
  });

  test("handles rejection in one of many concurrent operations", async () => {
    async function* concurrentTestNumbers() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
      yield 6;
    }

    await expect(asyncIterMap(concurrentTestNumbers(), async (x: number) => {
      if (x === 3) {
        throw new Error("Third item failed");
      }
      await new Promise(resolve => globalThis.setTimeout(resolve, 50));
      return x * 2;
    })).rejects.toThrow("Third item failed");
  });

  test("works with async iterable from arrays", async () => {
    async function* fromArray() {
      const arr = ["a", "b", "c", "d"];
      for (const item of arr) {
        yield item;
      }
    }

    const result = await asyncIterMap(fromArray(), async (str: string) => {
      return `${str}-processed`;
    });

    expect(result).toEqual(["a-processed", "b-processed", "c-processed", "d-processed"]);
  });

  test("handles complex async operations with side effects", async () => {
    const sideEffects: string[] = [];

    async function* tasks() {
      yield { name: "task1", duration: 100 };
      yield { name: "task2", duration: 50 };
      yield { name: "task3", duration: 75 };
    }

    const result = await asyncIterMap(tasks(), async (task) => {
      await new Promise(resolve => globalThis.setTimeout(resolve, task.duration));
      sideEffects.push(`${task.name}-completed`);
      return {
        taskName: task.name,
        completedAt: Date.now()
      };
    });

    // Verify results maintain order
    expect(result[0]?.taskName).toBe("task1");
    expect(result[1]?.taskName).toBe("task2");
    expect(result[2]?.taskName).toBe("task3");

    // Verify all side effects occurred
    expect(sideEffects).toHaveLength(3);
    expect(sideEffects).toContain("task1-completed");
    expect(sideEffects).toContain("task2-completed");
    expect(sideEffects).toContain("task3-completed");
  });

  test("handles async functions that return promises", async () => {
    async function* urls() {
      yield "/api/user/1";
      yield "/api/user/2";
      yield "/api/user/3";
    }

    // Simulate API calls
    const mockFetch = async (url: string) => {
      await new Promise(resolve => globalThis.setTimeout(resolve, 30));
      return {
        url,
        data: { id: url.split("/").pop(), name: `User ${url.split("/").pop()}` }
      };
    };

    const result = await asyncIterMap(urls(), mockFetch);

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "id": "1",
            "name": "User 1",
          },
          "url": "/api/user/1",
        },
        {
          "data": {
            "id": "2",
            "name": "User 2",
          },
          "url": "/api/user/2",
        },
        {
          "data": {
            "id": "3",
            "name": "User 3",
          },
          "url": "/api/user/3",
        },
      ]
    `);
  });

  test("works with large number of items", async () => {
    async function* manyNumbers() {
      for (let i = 1; i <= 100; i++) {
        yield i;
      }
    }

    const startTime = Date.now();
    const result = await asyncIterMap(manyNumbers(), async (x: number) => {
      // Small delay to ensure concurrency benefits
      await new Promise(resolve => globalThis.setTimeout(resolve, 5));
      return x * x;
    });
    const duration = Date.now() - startTime;

    expect(result).toHaveLength(100);
    expect(result[0]).toBe(1);
    expect(result[9]).toBe(100);
    expect(result[99]).toBe(10000);

    // With 100 items taking 5ms each, sequential would be 500ms
    // Concurrent should be much faster
    expect(duration).toBeLessThan(200);
  });

  test("handles async functions that resolve immediately", async () => {
    async function* immediateNumbers() {
      yield 100;
      yield 200;
      yield 300;
    }

    const result = await asyncIterMap(immediateNumbers(), async (x: number) => {
      // Immediate resolution
      return Promise.resolve(x / 100);
    });

    expect(result).toEqual([1, 2, 3]);
  });

  test("maintains type safety with generic types", async () => {
    interface IUser {
      id: number;
      name: string;
    }

    interface IProcessedUser {
      userId: number;
      displayName: string;
      processed: boolean;
    }

    async function* users(): AsyncGenerator<IUser> {
      yield { id: 1, name: "Alice" };
      yield { id: 2, name: "Bob" };
    }

    const result: IProcessedUser[] = await asyncIterMap(users(), async (user: IUser): Promise<IProcessedUser> => {
      return {
        userId: user.id,
        displayName: user.name.toUpperCase(),
        processed: true
      };
    });

    expect(result).toEqual([
      { userId: 1, displayName: "ALICE", processed: true },
      { userId: 2, displayName: "BOB", processed: true }
    ]);
  });

  test("handles nested async operations", async () => {
    async function* outerData() {
      yield [1, 2];
      yield [3, 4];
      yield [5, 6];
    }

    const result = await asyncIterMap(outerData(), async (numbers: number[]) => {
      // Simulate nested async operation
      const processed = await Promise.all(
        numbers.map(async (n) => {
          await new Promise(resolve => globalThis.setTimeout(resolve, 10));
          return n * 10;
        })
      );
      return processed;
    });

    expect(result).toEqual([
      [10, 20],
      [30, 40],
      [50, 60]
    ]);
  });
});