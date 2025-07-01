// This file provides utilities for concatenating multiple ReadableStreams into a single stream
// It handles sequential stream processing with proper error handling

import { ReadableStream } from "node:stream/web";

export const concatStreams = (streams: ReadableStream[]) => {
  return new ReadableStream({
    async start(controller) {
      try {
        for (const stream of streams) {
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
