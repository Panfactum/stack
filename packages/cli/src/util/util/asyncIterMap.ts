// This file provides utilities for mapping async iterables to arrays
// It processes all items concurrently while maintaining order

/**
 * Maps an async iterable to an array by applying an async function to each item
 * 
 * @remarks
 * This utility function processes all items from an async iterable concurrently,
 * collecting the results into an array. Unlike sequential processing, this
 * approach can significantly improve performance when dealing with I/O-bound
 * operations.
 * 
 * Key characteristics:
 * - Processes all items concurrently
 * - Maintains the original order of results
 * - Waits for all operations to complete
 * - Handles errors via Promise.all rejection
 * 
 * Common use cases:
 * - Processing streaming data with async transformations
 * - Batch API calls from async generators
 * - Parallel file processing from directory listings
 * - Transforming database query results
 * 
 * @param asyncIter - The async iterable to process
 * @param asyncFunc - The async function to apply to each item
 * @returns Promise resolving to array of transformed results
 * 
 * @typeParam T - The type of items in the async iterable
 * @typeParam R - The return type of the async function
 * 
 * @example
 * ```typescript
 * // Process API results concurrently
 * async function* fetchPages() {
 *   for (let page = 1; page <= 5; page++) {
 *     yield { page, url: `/api/data?page=${page}` };
 *   }
 * }
 * 
 * const results = await asyncIterMap(
 *   fetchPages(),
 *   async ({ url }) => {
 *     const response = await fetch(url);
 *     return response.json();
 *   }
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Transform file contents
 * async function* readFiles() {
 *   yield* ['file1.txt', 'file2.txt', 'file3.txt'];
 * }
 * 
 * const contents = await asyncIterMap(
 *   readFiles(),
 *   async (filename) => {
 *     return fs.readFile(filename, 'utf-8');
 *   }
 * );
 * ```
 * 
 * @throws Any errors thrown by the async function will cause Promise.all to reject
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of} - For async iteration
 * @see {@link Promise.all} - For concurrent promise handling
 */

export async function asyncIterMap<T, R>(asyncIter: AsyncIterable<T>, asyncFunc: (val: T) => Promise<R>) {
    const promises = [];
    for await (const value of asyncIter) {
        promises.push(asyncFunc(value))
    }
    return Promise.all(promises)
}