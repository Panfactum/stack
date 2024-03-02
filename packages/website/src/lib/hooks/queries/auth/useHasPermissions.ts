import type { Permission } from '@panfactum/primary-api/src/db/models/OrganizationRolePermission'
import { useMemo } from 'react'

import useUrlOrgId from '@/lib/hooks/navigation/useUrlOrgId'
import { useIdentity } from '@/lib/hooks/queries/auth/useIdentity'

export type AuthCheck = {hasOneOf?: Permission[], hasAllOf?: Permission[]}
export function useHasPermissions (check: AuthCheck): boolean {
  const { data: identity } = useIdentity()
  const orgId = useUrlOrgId()

  return useMemo(() => {
    if (orgId === null || identity === undefined) {
      console.warn('Tried to derive permissions but orgId or identity was undefined.')
      return false
    }

    const currentOrg = identity.organizations.find(org => org.id === orgId)

    if (currentOrg === undefined) {
      console.warn('Tried to derive permissions but current org is set to an organization the user is not a member of')
      return false
    }

    const { permissions } = currentOrg

    const permissionsSet = new Set<Permission>(permissions)

    if (!check.hasOneOf && !check.hasAllOf) {
      console.warn('Used useHasPermissions hook without any check parameters. Defaulting to false.')
      return false
    }

    for (const permission of check.hasAllOf ?? []) {
      if (!permissionsSet.has(permission)) {
        return false
      }
    }

    if (check.hasOneOf) {
      for (const permission of check.hasOneOf ?? []) {
        if (permissionsSet.has(permission)) {
          return true
        }
      }
      return false
    } else {
      return true
    }
  }, [identity, orgId, check])
}
