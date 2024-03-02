import type {
  OrganizationMembershipsFiltersType,
  OrganizationMembershipSortType,
  OrganizationMembershipsResultType,
  OrganizationMembershipUpdateDeltaType
} from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'
import { RQUpdateResourceHookFactory } from '@/lib/hooks/queries/util/RQUpdateResourceHookFactory'

const resource = 'organization-membership'
const apiPath = '/v1/organization-memberships'

export const {
  useGetOne: useGetOneOrganizationMembership,
  usePrefetchGetOne: usePrefetchGetOneOrganizationMembership,
  useGetList: useGetListOrganizationMembership,
  usePrefetchGetList: usePrefetchGetListOrganizationMembership
} = RQGetResourceHookFactory<
  OrganizationMembershipsResultType,
  OrganizationMembershipSortType,
  OrganizationMembershipsFiltersType
>(
  resource,
  apiPath
)

export const {
  useUpdateOne: useUpdateOneOrganizationMembership,
  useUpdateMany: useUpdateManyOrganizationMembership
} = RQUpdateResourceHookFactory<OrganizationMembershipsResultType, OrganizationMembershipUpdateDeltaType>(
  resource,
  apiPath
)
