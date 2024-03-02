import type {
  PackageFiltersType,
  PackageResultType,
  PackageSortType,
  PackagesUpdateDeltaType
} from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'
import { RQUpdateResourceHookFactory } from '@/lib/hooks/queries/util/RQUpdateResourceHookFactory'

const resource = 'package'
const apiPath = '/v1/packages'
export const {
  useGetOne: useGetOnePackage,
  usePrefetchGetOne: usePrefetchGetOnePackage,
  useGetList: useGetListPackage,
  usePrefetchGetList: usePrefetchGetListPackage
} = RQGetResourceHookFactory<
  PackageResultType,
  PackageSortType,
  PackageFiltersType
>(
  resource,
  apiPath
)

export const {
  useUpdateOne: useUpdateOnePackage,
  useUpdateMany: useUpdateManyPackage
} = RQUpdateResourceHookFactory<PackageResultType, PackagesUpdateDeltaType>(
  resource,
  apiPath
)
