/**
 * Input parameters for extracting last path segments
 */
interface IGetLastPathSegmentsInput {
  /** The file path to process */
  path: string;
  /** Number of segments to extract from the end */
  lastSegments: number;
}

/**
 * Extracts the last N segments from a file path
 * 
 * @remarks
 * This utility function is useful for extracting relative paths from
 * absolute paths, or for getting just the filename and parent directory
 * from a full path.
 * 
 * @param input - Path extraction parameters
 * @returns The last N segments joined with forward slashes
 * 
 * @example
 * ```typescript
 * // Get filename only
 * const filename = getLastPathSegments({
 *   path: '/home/user/documents/report.pdf',
 *   lastSegments: 1
 * });
 * // Returns: "report.pdf"
 * ```
 * 
 * @example
 * ```typescript
 * // Get filename with parent directory
 * const relativePath = getLastPathSegments({
 *   path: '/home/user/documents/report.pdf',
 *   lastSegments: 2
 * });
 * // Returns: "documents/report.pdf"
 * ```
 */
export function getLastPathSegments(input: IGetLastPathSegmentsInput): string {
    const { path, lastSegments } = input;
    return path.split("/").slice(-lastSegments).join("/")
}