// This file provides utilities for merging multiple ReadableStreams into a single stream
// It handles concurrent stream processing with proper error handling and interleaving

import type { ReadableStream, ReadableStreamDefaultReader } from "node:stream/web";

/**
 * Interface for input parameters to the mergeStreams function
 */
interface IMergeStreamsInput {
  /** The array of ReadableStreams to merge concurrently */
  streams: ReadableStream[];
}

/**
 * Merges multiple ReadableStreams into a single ReadableStream with interleaving
 * 
 * @remarks
 * This function is part of the streams utility subsystem and provides a way to
 * concurrently combine multiple streams into one. Chunks from all streams are
 * interleaved based on when they become available, allowing for efficient
 * parallel processing of multiple data sources.
 * 
 * Unlike {@link concatStreams}, which processes streams sequentially, this
 * function reads from all streams concurrently and outputs chunks as they arrive.
 * 
 * @param input - The input parameters for the function. See {@link IMergeStreamsInput}
 * @returns A new ReadableStream containing interleaved chunks from all input streams
 * 
 * @example
 * ```typescript
 * const stream1 = new ReadableStream({
 *   async start(controller) {
 *     await delay(10);
 *     controller.enqueue('slow-1');
 *     await delay(50);
 *     controller.enqueue('slow-2');
 *     controller.close();
 *   }
 * });
 * 
 * const stream2 = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue('fast-1');
 *     controller.enqueue('fast-2');
 *     controller.close();
 *   }
 * });
 * 
 * const merged = mergeStreams({ streams: [stream1, stream2] });
 * const reader = merged.getReader();
 * // Reads will return: 'fast-1', 'fast-2', 'slow-1', 'slow-2'
 * // based on arrival time, not stream order
 * ```
 * 
 * @throws {@link Error}
 * Throws when any of the source streams encounter an error
 * 
 * @see {@link concatStreams} - For sequential stream processing
 * @see {@link globalThis.ReadableStream} - For more information about ReadableStreams
 */
export const mergeStreams = (input: IMergeStreamsInput): ReadableStream => {
  // Store readers at the closure level for cancel access
  let storedReaders: ReadableStreamDefaultReader[] = [];
  
  return new globalThis.ReadableStream({
    async start(controller) {
      const { streams } = input;
      
      if (streams.length === 0) {
        controller.close();
        return;
      }

      // Create readers for all streams
      const readers = streams.map(stream => stream.getReader());
      storedReaders = readers;
      
      // Track which streams are still active
      const activeStreams = new Set(readers.map((_, index) => index));
      
      // Flag to track if we're shutting down
      let isShuttingDown = false;
      
      /**
       * Reads continuously from a specific stream
       * 
       * @internal
       * @param readerIndex - Index of the reader to read from
       */
      const readFromStream = async (readerIndex: number): Promise<void> => {
        const reader = readers[readerIndex];
        if (!reader || !activeStreams.has(readerIndex) || isShuttingDown) return;
        
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            activeStreams.delete(readerIndex);
            
            // If all streams are done, close the controller
            if (activeStreams.size === 0 && !isShuttingDown) {
              controller.close();
            }
          } else {
            // Enqueue the value and continue reading
            if (!isShuttingDown) {
              controller.enqueue(value);
              
              // Schedule next read from this stream
              if (activeStreams.has(readerIndex)) {
                // Use setTimeout to avoid stack overflow and allow error propagation
                globalThis.setTimeout(() => {
                  readFromStream(readerIndex).catch(() => {
                    // Error is handled inside readFromStream
                  });
                }, 0);
              }
            }
          }
        } catch (error) {
          if (!isShuttingDown) {
            isShuttingDown = true;
            
            // Remove this stream from active set
            activeStreams.delete(readerIndex);
            
            // Release all readers
            await Promise.all(readers.map(async r => {
              try {
                await r.cancel();
              } catch {
                // Ignore cancellation errors
              }
            }));
            
            // Propagate the error
            controller.error(error);
          }
        }
      };
      
      // Start reading from all streams concurrently
      try {
        await Promise.all(
          readers.map((_, i) => readFromStream(i))
        );
      } catch (error) {
        // If any initial read fails, ensure cleanup
        if (!isShuttingDown) {
          isShuttingDown = true;
          await Promise.all(readers.map(r => r.cancel().catch(() => {})));
          controller.error(error);
        }
      }
    },
    
    async cancel(reason) {
      // Cancel all stored readers
      await Promise.all(
        storedReaders.map(reader => 
          reader.cancel(reason).catch(() => {
            // Ignore cancellation errors
          })
        )
      );
    }
  });
};