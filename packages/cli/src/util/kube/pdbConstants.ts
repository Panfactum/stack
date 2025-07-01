/**
 * Panfactum PodDisruptionBudget annotation keys
 */
export const PDB_ANNOTATIONS = {
  /** Maximum unavailable pods during disruption window */
  MAX_UNAVAILABLE: 'panfactum.com/voluntary-disruption-window-max-unavailable',
  /** Unix timestamp when disruption window started */
  WINDOW_START: 'panfactum.com/voluntary-disruption-window-start',
  /** Duration of disruption window in seconds */
  WINDOW_SECONDS: 'panfactum.com/voluntary-disruption-window-seconds'
} as const;