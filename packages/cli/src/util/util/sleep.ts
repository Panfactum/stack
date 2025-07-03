// Sleep utility function
// Provides async/await compatible sleep functionality

import { setTimeout } from 'timers/promises';

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export async function sleep(ms: number): Promise<void> {
  return setTimeout(ms);
}