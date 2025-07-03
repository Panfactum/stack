// Unit tests for the mergeStreams utility function
// Tests concurrent stream merging with interleaving behavior

import { describe, expect, test } from 'bun:test';
import { mergeStreams } from './mergeStreams';

describe('mergeStreams', () => {
  test('merges streams with interleaved chunks based on timing', async () => {
    const chunks: { value: string; timestamp: number }[] = [];
    const startTime = Date.now();

    // Stream 1: Slow stream with delays
    const stream1 = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 30));
        controller.enqueue('stream1-chunk1');
        await new Promise(resolve => globalThis.setTimeout(resolve, 40));
        controller.enqueue('stream1-chunk2');
        controller.close();
      }
    });

    // Stream 2: Fast stream that emits immediately
    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('stream2-chunk1');
        controller.enqueue('stream2-chunk2');
        controller.close();
      }
    });

    // Stream 3: Medium speed stream
    const stream3 = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('stream3-chunk1');
        await new Promise(resolve => globalThis.setTimeout(resolve, 30));
        controller.enqueue('stream3-chunk2');
        controller.close();
      }
    });

    const merged = mergeStreams({ streams: [stream1, stream2, stream3] });
    const reader = merged.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push({
        value,
        timestamp: Date.now() - startTime
      });
    }

    // Extract just the values for the snapshot
    const values = chunks.map(c => c.value);

    // Verify interleaved order based on timing:
    // stream2 chunks come first (immediate)
    // stream3-chunk1 at ~10ms
    // stream1-chunk1 at ~30ms
    // stream3-chunk2 at ~40ms
    // stream1-chunk2 at ~70ms
    expect(values).toMatchInlineSnapshot(`
      [
        "stream2-chunk1",
        "stream2-chunk2",
        "stream3-chunk1",
        "stream1-chunk1",
        "stream3-chunk2",
        "stream1-chunk2",
      ]
    `);
  });

  test('handles empty streams array', async () => {
    const merged = mergeStreams({ streams: [] });
    const reader = merged.getReader();

    const { done, value } = await reader.read();

    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });

  test('handles single stream', async () => {
    const stream = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.close();
      }
    });

    const merged = mergeStreams({ streams: [stream] });
    const reader = merged.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
      [
        "chunk1",
        "chunk2",
      ]
    `);
  });

  test('handles streams that close at different times', async () => {
    // Stream that closes early
    const shortStream = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('short-1');
        controller.close();
      }
    });

    // Stream that continues longer
    const longStream = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('long-1');
        await new Promise(resolve => globalThis.setTimeout(resolve, 20));
        controller.enqueue('long-2');
        await new Promise(resolve => globalThis.setTimeout(resolve, 20));
        controller.enqueue('long-3');
        controller.close();
      }
    });

    const merged = mergeStreams({ streams: [shortStream, longStream] });
    const reader = merged.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
      [
        "short-1",
        "long-1",
        "long-2",
        "long-3",
      ]
    `);
  });

  test('propagates errors from source streams', async () => {
    const errorMessage = 'Stream error';

    const errorStream = new globalThis.ReadableStream({
      start(controller) {
        // Error immediately
        controller.error(new Error(errorMessage));
      }
    });

    const merged = mergeStreams({ streams: [errorStream] });
    const reader = merged.getReader();

    // Should encounter the error
    await expect(reader.read()).rejects.toThrow(errorMessage);
  });

  test('handles mixed data types', async () => {
    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('text');
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });

    const stream3 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue({ data: 'object' });
        controller.enqueue(42);
        controller.close();
      }
    });

    const merged = mergeStreams({ streams: [stream1, stream2, stream3] });
    const reader = merged.getReader();

    const chunks: unknown[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
      [
        "text",
        Uint8Array [
          1,
          2,
          3,
        ],
        {
          "data": "object",
        },
        42,
      ]
    `);
  });

  test('handles empty streams mixed with non-empty streams', async () => {
    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('before');
        controller.close();
      }
    });

    const emptyStream = new globalThis.ReadableStream({
      start(controller) {
        // Close immediately without enqueuing anything
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('after');
        controller.close();
      }
    });

    const merged = mergeStreams({ streams: [stream1, emptyStream, stream2] });
    const reader = merged.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
      [
        "before",
        "after",
      ]
    `);
  });

  test('handles high concurrency with many streams', async () => {
    // Create 10 streams with different speeds
    const streams = Array.from({ length: 10 }, (_, i) =>
      new globalThis.ReadableStream({
        async start(controller) {
          // Each stream has different timing
          await new Promise(resolve => globalThis.setTimeout(resolve, i * 5));
          controller.enqueue(`stream${i}-chunk1`);
          await new Promise(resolve => globalThis.setTimeout(resolve, 10));
          controller.enqueue(`stream${i}-chunk2`);
          controller.close();
        }
      })
    );

    const merged = mergeStreams({ streams });
    const reader = merged.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Should have all 20 chunks (2 per stream)
    expect(chunks.length).toBe(20);

    // Verify all streams contributed their chunks
    for (let i = 0; i < 10; i++) {
      expect(chunks).toContain(`stream${i}-chunk1`);
      expect(chunks).toContain(`stream${i}-chunk2`);
    }

    // First chunks should be from faster streams (lower indices)
    expect(chunks[0]).toBe('stream0-chunk1');
  });

  test('handles backpressure correctly', async () => {
    let pullCount = 0;

    // Stream that tracks pull calls
    const stream = new globalThis.ReadableStream({
      async pull(controller) {
        pullCount++;
        if (pullCount <= 5) {
          await new Promise(resolve => globalThis.setTimeout(resolve, 10));
          controller.enqueue(`chunk-${pullCount}`);
        } else {
          controller.close();
        }
      }
    });

    const merged = mergeStreams({ streams: [stream] });
    const reader = merged.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);

      // Simulate slow consumer
      await new Promise(resolve => globalThis.setTimeout(resolve, 5));
    }

    expect(chunks).toMatchInlineSnapshot(`
      [
        "chunk-1",
        "chunk-2",
        "chunk-3",
        "chunk-4",
        "chunk-5",
      ]
    `);
    // Pull count might be 6 due to the initial start and subsequent pulls
    expect(pullCount).toBeGreaterThanOrEqual(5);
    expect(pullCount).toBeLessThanOrEqual(6);
  });

  test('cleans up resources when cancelled', async () => {
    let stream1Cancelled = false;
    let stream2Cancelled = false;

    const stream1 = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 100));
        controller.enqueue('never-read');
        controller.close();
      },
      cancel() {
        stream1Cancelled = true;
      }
    });

    const stream2 = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 100));
        controller.enqueue('never-read');
        controller.close();
      },
      cancel() {
        stream2Cancelled = true;
      }
    });

    const merged = mergeStreams({ streams: [stream1, stream2] });
    const reader = merged.getReader();

    // Cancel immediately
    await reader.cancel();

    // Give time for cancellation to propagate
    await new Promise(resolve => globalThis.setTimeout(resolve, 10));

    expect(stream1Cancelled).toBe(true);
    expect(stream2Cancelled).toBe(true);
  });

  test('does not block on streams with no traffic', async () => {
    const startTime = Date.now();
    const chunks: { value: string; timestamp: number }[] = [];

    // Stream 1: Active stream that produces chunks regularly
    const activeStream = new globalThis.ReadableStream({
      async start(controller) {
        controller.enqueue('active-1');
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('active-2');
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('active-3');
        controller.close();
      }
    });

    // Stream 2: Slow stream that takes a very long time to produce anything
    const slowStream = new globalThis.ReadableStream({
      async start(controller) {
        // Wait 500ms before producing anything
        await new Promise(resolve => globalThis.setTimeout(resolve, 500));
        controller.enqueue('slow-1');
        controller.close();
      }
    });

    // Stream 3: Stream that never produces anything (just hangs)
    let stream3Cancelled = false;
    let hangingStreamResolve: (() => void) | undefined;
    const hangingStream = new globalThis.ReadableStream({
      async start() {
        // This stream just waits forever until cancelled
        await new Promise<void>((resolve) => {
          // Store resolve for potential cancellation
          hangingStreamResolve = resolve;
        });
      },
      cancel() {
        stream3Cancelled = true;
        // Resolve the hanging promise if it exists
        if (hangingStreamResolve) {
          hangingStreamResolve();
        }
      }
    });

    const merged = mergeStreams({ streams: [activeStream, slowStream, hangingStream] });
    const reader = merged.getReader();

    // Read chunks with a timeout
    const readWithTimeout = async (timeoutMs: number) => {
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
        globalThis.setTimeout(() => resolve({ timeout: true }), timeoutMs)
      );

      const readPromise = reader.read();
      const result = await Promise.race([readPromise, timeoutPromise]);

      if ('timeout' in result) {
        return { done: true, value: undefined };
      }
      return result;
    };

    // Read chunks from active stream (should not be blocked)
    while (true) {
      const result = await readWithTimeout(50); // 50ms timeout per read
      if (result.done) break;

      chunks.push({
        value: result.value,
        timestamp: Date.now() - startTime
      });

      // Stop reading after we get the active chunks
      if (chunks.length >= 3) break;
    }

    // Cancel the reader to clean up
    await reader.cancel();

    // Verify we got all active stream chunks quickly
    expect(chunks.map(c => c.value)).toMatchInlineSnapshot(`
      [
        "active-1",
        "active-2",
        "active-3",
      ]
    `);

    // Verify chunks arrived quickly (should be under 100ms total)
    const lastChunkTime = chunks[chunks.length - 1]?.timestamp || 0;
    expect(lastChunkTime).toBeLessThan(100);

    // Verify the hanging stream was cancelled
    expect(stream3Cancelled).toBe(true);
  });
});