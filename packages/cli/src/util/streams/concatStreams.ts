import { PassThrough, Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

export const concatStreams = (streamArray: Array<ReadableStream>) => {
  // Create a new PassThrough stream that will be used to combine all streams
  const combinedStream = new PassThrough();
  
  // Process each ReadableStream in the array
  for (const stream of streamArray) {
    // Convert Web ReadableStream to Node.js Readable stream
    const nodeReadable = Readable.fromWeb(stream);
    
    // Pipe each stream to the combined stream
    nodeReadable.pipe(combinedStream, { end: false });
    
    // Handle errors on individual streams
    nodeReadable.on('error', (err) => {
      combinedStream.emit('error', err);
    });
    
    // When a stream ends, we don't want to end the combined stream yet
    nodeReadable.on('end', () => {
      // Do nothing, we'll handle the end of the combined stream separately
    });
  }
  
  // Count how many streams have ended
  let endedStreams = 0;
  
  // Set up listeners for each stream to track when they all end
  for (const stream of streamArray) {
    const nodeReadable = Readable.fromWeb(stream);
    
    nodeReadable.on('end', () => {
      endedStreams++;
      
      // When all streams have ended, end the combined stream
      if (endedStreams === streamArray.length) {
        combinedStream.end();
      }
    });
  }
  
  // Convert the Node.js PassThrough back to a Web ReadableStream
  return Readable.toWeb(combinedStream);
}