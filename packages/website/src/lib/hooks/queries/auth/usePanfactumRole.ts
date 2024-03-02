import { useIdentity } from '@/lib/hooks/queries/auth/useIdentity'

export function useHasPanfactumRole (oneOf: string[]): boolean {
  const { data: identity } = useIdentity()

  if (identity === undefined) {
    console.warn('Tried to derive permissions but identity was undefined.')
    return false
  }

  const role = identity.panfactumRole

  if (role === null) {
    return false
  }

  for (const checkRole of oneOf) {
    if (role === checkRole) {
      return true
    }
  }

  return false
}
