import type {
  PackageVersionFiltersType,
  PackageVersionResultType, PackageVersionSortType, PackageVersionsUpdateDeltaType
} from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'
import { RQUpdateResourceHookFactory } from '@/lib/hooks/queries/util/RQUpdateResourceHookFactory'

const resource = 'package-version'
const apiPath = '/v1/package-versions'

export const {
  useGetOne: useGetOnePackageVersion,
  usePrefetchGetOne: usePrefetchGetOnePackageVersion,
  useGetList: useGetListPackageVersion,
  usePrefetchGetList: usePrefetchGetListPackageVersion
} = RQGetResourceHookFactory<
  PackageVersionResultType,
  PackageVersionSortType,
  PackageVersionFiltersType
>(
  resource,
  apiPath
)

export const {
  useUpdateOne: useUpdateOnePackageVersion,
  useUpdateMany: useUpdateManyPackageVersion
} = RQUpdateResourceHookFactory<PackageVersionResultType, PackageVersionsUpdateDeltaType>(
  resource,
  apiPath
)
