import type {
  OrganizationRolesFiltersType, OrganizationRoleSortType,
  OrganizationRolesResultType, OrganizationRolesUpdateDeltaType
  , OrganizationRolesCreateBodyElementType
} from '@panfactum/primary-api'

import { RQCreateResourceHookFactory } from '@/lib/hooks/queries/util/RQCreateResourceHookFactory'
import { RQDeleteResourceHookFactory } from '@/lib/hooks/queries/util/RQDeleteResourceHookFactory'
import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'
import { RQUpdateResourceHookFactory } from '@/lib/hooks/queries/util/RQUpdateResourceHookFactory'

const resource = 'organization-role'
const apiPath = '/v1/organization-roles'

export const {
  useGetOne: useGetOneOrganizationRole,
  usePrefetchGetOne: usePrefetchGetOneOrganizationRole,
  useGetList: useGetListOrganizationRole,
  usePrefetchGetList: usePrefetchGetListOrganizationRole
} = RQGetResourceHookFactory<
  OrganizationRolesResultType,
  OrganizationRoleSortType,
  OrganizationRolesFiltersType
>(
  resource,
  apiPath
)

export const {
  useUpdateOne: useUpdateOneOrganizationRole,
  useUpdateMany: useUpdateManyOrganizationRole
} = RQUpdateResourceHookFactory<OrganizationRolesResultType, OrganizationRolesUpdateDeltaType>(
  resource,
  apiPath
)

export const {
  useDeleteOne: useDeleteOneOrganizationRole,
  useDeleteMany: useDeleteManyOrganizationRole
} = RQDeleteResourceHookFactory(
  resource,
  apiPath
)

export const {
  useCreateOne: useCreateOneOrganizationRole,
  useCreateMany: useCreateManyOrganizationRole
} = RQCreateResourceHookFactory<
  OrganizationRolesResultType,
  OrganizationRolesCreateBodyElementType
>(
  resource,
  apiPath
)
