// This file provides utilities for opening URLs in the default browser
// It ensures browser operations don't crash the CLI

import open from "open";

/**
 * Opens a URL in the default browser without throwing errors
 * 
 * @remarks
 * This function provides a fail-safe wrapper around the `open` library
 * to ensure that browser-related failures don't crash the CLI. This is
 * important because:
 * 
 * - Users may be in headless environments (SSH, containers)
 * - Browser configuration may be broken
 * - Security policies may block browser launches
 * - The system may not have a default browser
 * 
 * Common use cases:
 * - Opening authentication URLs
 * - Displaying documentation
 * - Launching web interfaces
 * - OAuth/OIDC flows
 * 
 * The function silently catches and ignores all errors, allowing
 * the CLI to continue functioning even when browser access fails.
 * 
 * @param url - The URL to open in the browser
 * 
 * @example
 * ```typescript
 * // Open documentation
 * await failsafeOpen('https://panfactum.com/docs');
 * 
 * // Open OAuth login page
 * await failsafeOpen('https://auth.example.com/login?token=abc123');
 * 
 * // Function continues even if browser fails
 * await failsafeOpen('https://example.com');
 * console.log('This runs regardless of browser success');
 * ```
 * 
 * @see {@link open} - The underlying browser opening library
 */
export async function failsafeOpen(url: string): Promise<void> {
    try {
        await open(url)
    } catch {
        // if open fails, don't fail the cli
    }
}