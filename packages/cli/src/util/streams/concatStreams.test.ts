// Unit tests for the concatStreams utility function
// Tests sequential stream concatenation with various scenarios

import { describe, expect, test } from 'bun:test';
import { concatStreams } from './concatStreams';

describe('concatStreams', () => {
  test('concatenates multiple streams with Uint8Array chunks', async () => {
    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      }
    });

    const stream3 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([7, 8, 9]));
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, stream2, stream3] });
    const reader = combined.getReader();

    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
[
  Uint8Array [
    1,
    2,
    3,
  ],
  Uint8Array [
    4,
    5,
    6,
  ],
  Uint8Array [
    7,
    8,
    9,
  ],
]
`);
  });

  test('concatenates streams with string chunks', async () => {
    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('Hello');
        controller.enqueue(' ');
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('World');
        controller.enqueue('!');
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, stream2] });
    const reader = combined.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
[
  "Hello",
  " ",
  "World",
  "!",
]
`);
  });

  test('handles empty streams array', async () => {
    const combined = concatStreams({ streams: [] });
    const reader = combined.getReader();

    const { done, value } = await reader.read();

    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });

  test('handles single stream', async () => {
    const stream = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('single');
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream] });
    const reader = combined.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
[
  "single",
]
`);
  });

  test('handles streams with mixed data types', async () => {
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
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, stream2, stream3] });
    const reader = combined.getReader();

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
]
`);
  });

  test('handles empty streams', async () => {
    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('before');
        controller.close();
      }
    });

    const emptyStream = new globalThis.ReadableStream({
      start(controller) {
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('after');
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, emptyStream, stream2] });
    const reader = combined.getReader();

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

  test('propagates errors from source streams', async () => {
    const errorMessage = 'Stream error';

    const stream1 = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue('first');
        controller.close();
      }
    });

    const errorStream = new globalThis.ReadableStream({
      start(controller) {
        controller.error(new Error(errorMessage));
      }
    });

    const combined = concatStreams({ streams: [stream1, errorStream] });
    const reader = combined.getReader();

    // Read the first chunk successfully
    const { value: firstValue } = await reader.read();
    expect(firstValue).toBe('first');

    // The next read should throw the error
    await expect(reader.read()).rejects.toThrow(errorMessage);
  });

  test('handles async streams', async () => {
    const stream1 = new globalThis.ReadableStream({
      async start(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 100));
        controller.enqueue('delayed1');
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      async pull(controller) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('delayed2');
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, stream2] });
    const reader = combined.getReader();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks).toMatchInlineSnapshot(`
[
  "delayed1",
  "delayed2",
]
`);
  });

  test('respects stream order', async () => {
    const createNumberStream = (start: number, count: number) => {
      return new globalThis.ReadableStream({
        start(controller) {
          for (let i = 0; i < count; i++) {
            controller.enqueue(start + i);
          }
          controller.close();
        }
      });
    };

    const streams = [
      createNumberStream(0, 3),
      createNumberStream(10, 3),
      createNumberStream(20, 3)
    ];

    const combined = concatStreams({ streams });
    const reader = combined.getReader();

    const numbers: number[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      numbers.push(value);
    }

    expect(numbers).toMatchInlineSnapshot(`
[
  0,
  1,
  2,
  10,
  11,
  12,
  20,
  21,
  22,
]
`);
  });

  test('verifies sequential processing (no interleaving)', async () => {
    // This test verifies that concatStreams processes streams sequentially,
    // NOT interleaved. Each stream is fully consumed before the next begins.
    
    const chunks: { chunk: string; timestamp: number }[] = [];
    const startTime = Date.now();
    
    // Create streams with different timing to show sequential processing
    const stream1 = new globalThis.ReadableStream({
      async start(controller) {
        // Stream 1 has delays between chunks
        controller.enqueue('stream1-chunk1');
        await new Promise(resolve => globalThis.setTimeout(resolve, 50));
        controller.enqueue('stream1-chunk2');
        await new Promise(resolve => globalThis.setTimeout(resolve, 50));
        controller.enqueue('stream1-chunk3');
        controller.close();
      }
    });

    const stream2 = new globalThis.ReadableStream({
      start(controller) {
        // Stream 2 emits all chunks immediately
        // But they should only appear AFTER all of stream1
        controller.enqueue('stream2-chunk1');
        controller.enqueue('stream2-chunk2');
        controller.close();
      }
    });

    const stream3 = new globalThis.ReadableStream({
      async start(controller) {
        // Stream 3 has a small delay
        await new Promise(resolve => globalThis.setTimeout(resolve, 10));
        controller.enqueue('stream3-chunk1');
        controller.close();
      }
    });

    const combined = concatStreams({ streams: [stream1, stream2, stream3] });
    const reader = combined.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push({ 
        chunk: value, 
        timestamp: Date.now() - startTime 
      });
    }

    // Extract just the chunk values for the snapshot
    const chunkValues = chunks.map(c => c.chunk);
    
    // Verify sequential order: all stream1, then all stream2, then all stream3
    expect(chunkValues).toMatchInlineSnapshot(`
[
  "stream1-chunk1",
  "stream1-chunk2",
  "stream1-chunk3",
  "stream2-chunk1",
  "stream2-chunk2",
  "stream3-chunk1",
]
`);

    // Verify timing shows stream2's chunks came after stream1 finished (roughly 100ms)
    // even though stream2 emits immediately
    const stream2FirstChunkTime = chunks.find(c => c.chunk === 'stream2-chunk1')?.timestamp || 0;
    expect(stream2FirstChunkTime).toBeGreaterThanOrEqual(95);
  });
});