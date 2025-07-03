// Tests for sleep utility function
// Verifies async/await sleep functionality and timing accuracy

import { test, expect, describe } from "bun:test";
import { sleep } from './sleep';

describe('sleep', () => {
  test('should sleep for the specified number of milliseconds', async () => {
    const start = Date.now();
    await sleep(100);
    const end = Date.now();
    const elapsed = end - start;
    
    // Allow for some timing variance (±10ms)
    expect(elapsed).toBeGreaterThanOrEqual(95);
    expect(elapsed).toBeLessThan(150);
  });

  test('should resolve immediately for 0 milliseconds', async () => {
    const start = Date.now();
    await sleep(0);
    const end = Date.now();
    const elapsed = end - start;
    
    // Should be very fast, allow up to 10ms for test overhead
    expect(elapsed).toBeLessThan(10);
  });

  test('should work with decimal values', async () => {
    const start = Date.now();
    await sleep(50.5);
    const end = Date.now();
    const elapsed = end - start;
    
    // Allow for timing variance
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });

  test('should return a Promise that resolves to void', async () => {
    const result = await sleep(1);
    expect(result).toBeUndefined();
  });
});