// This file provides PostHog analytics client configuration for tracking CLI usage
// It initializes the PostHog client with Panfactum-specific settings

import { PostHog } from 'posthog-node';

/**
 * PostHog analytics client instance for tracking CLI usage
 * 
 * @remarks
 * This client is configured to send analytics data to Panfactum's PostHog
 * instance. It tracks CLI command usage, errors, and performance metrics
 * to help improve the user experience and identify common issues.
 * 
 * The client uses the US PostHog endpoint and is configured with
 * Panfactum's project token for proper data attribution.
 * 
 * @example
 * ```typescript
 * // Track a command execution
 * phClient.capture({
 *   distinctId: 'user-id',
 *   event: 'command_executed',
 *   properties: {
 *     command: 'pf cluster add',
 *     duration_ms: 1500
 *   }
 * });
 * ```
 * 
 * @see {@link PostHog} - PostHog Node.js client documentation
 */
export const phClient = new PostHog(
  'phc_OAyUkW0PitOtfs2CpzRnSS3fL5HkKwSzO4MrcIibhtA',
  {
    host: 'https://us.i.posthog.com'
  }
);