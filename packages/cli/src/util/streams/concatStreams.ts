// This file provides utilities for concatenating multiple ReadableStreams into a single stream
// It handles sequential stream processing with proper error handling

import type { ReadableStream } from "node:stream/web";

/**
 * Interface for input parameters to the concatStreams function
 */
interface IConcatStreamsInput {
  /** The array of ReadableStreams to concatenate sequentially */
  streams: ReadableStream[];
}

/**
 * Concatenates multiple ReadableStreams into a single ReadableStream
 * 
 * @remarks
 * This function is part of the streams utility subsystem and provides a way to
 * sequentially combine multiple streams into one. Each stream is fully consumed
 * before moving to the next stream in the array.
 * 
 * @param input - The input parameters for the function. See {@link IConcatStreamsInput}
 * @returns A new ReadableStream containing the concatenated content of all input streams
 * 
 * @example
 * ```typescript
 * const stream1 = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(new Uint8Array([1, 2, 3]));
 *     controller.close();
 *   }
 * });
 * const stream2 = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(new Uint8Array([4, 5, 6]));
 *     controller.close();
 *   }
 * });
 * 
 * const combined = concatStreams({ streams: [stream1, stream2] });
 * const reader = combined.getReader();
 * // Reads will return chunks from stream1 first, then stream2
 * ```
 * 
 * @see {@link globalThis.ReadableStream} - For more information about ReadableStreams
 */
export const concatStreams = (input: IConcatStreamsInput): ReadableStream => {
  return new globalThis.ReadableStream({
    async start(controller) {
      try {
        for (const stream of input.streams) {
          const reader = stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
};
