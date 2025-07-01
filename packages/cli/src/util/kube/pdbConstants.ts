// This file defines constants for PodDisruptionBudget annotations used by Panfactum
// These annotations control voluntary disruption windows for maintenance operations

/**
 * Panfactum-specific annotation keys for PodDisruptionBudget resources
 * 
 * @remarks
 * These annotation keys are used to manage voluntary disruption windows
 * in Kubernetes PodDisruptionBudgets. During maintenance operations,
 * Panfactum can temporarily adjust PDB settings by adding these annotations
 * to allow controlled disruptions while maintaining service availability.
 * 
 * The voluntary disruption window system allows operators to:
 * - Temporarily increase the allowed disruptions for maintenance
 * - Track when disruption windows were activated
 * - Automatically revert changes after a specified duration
 * 
 * @example
 * ```typescript
 * // Setting annotations for a maintenance window
 * const annotations = {
 *   [PDB_ANNOTATIONS.MAX_UNAVAILABLE]: '50%',
 *   [PDB_ANNOTATIONS.WINDOW_START]: Math.floor(Date.now() / 1000).toString(),
 *   [PDB_ANNOTATIONS.WINDOW_SECONDS]: '3600' // 1 hour
 * };
 * ```
 * 
 * @see {@link getPDBAnnotations} - For retrieving these annotations
 * @see {@link getPDBsByWindowId} - For finding PDBs in a disruption window
 */
export const PDB_ANNOTATIONS = {
  /** 
   * Maximum unavailable pods/percentage during the disruption window
   * Value can be an integer (e.g., "2") or percentage (e.g., "50%")
   */
  MAX_UNAVAILABLE: 'panfactum.com/voluntary-disruption-window-max-unavailable',
  
  /** 
   * Unix timestamp (in seconds) when the disruption window was activated
   * Used to calculate when the window should expire
   */
  WINDOW_START: 'panfactum.com/voluntary-disruption-window-start',
  
  /** 
   * Duration of the disruption window in seconds
   * After this duration from WINDOW_START, the window should be closed
   */
  WINDOW_SECONDS: 'panfactum.com/voluntary-disruption-window-seconds'
} as const;