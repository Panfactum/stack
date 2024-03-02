import type {
  PackageDownloadFiltersType,
  PackageDownloadResultType, PackageDownloadSortType
} from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'

export const {
  useGetOne: useGetOnePackageDownload,
  usePrefetchGetOne: usePrefetchGetOnePackageDownload,
  useGetList: useGetListPackageDownload,
  usePrefetchGetList: usePrefetchGetListPackageDownload
} = RQGetResourceHookFactory<
  PackageDownloadResultType,
  PackageDownloadSortType,
  PackageDownloadFiltersType
>(
  'package-download',
  '/v1/package-downloads'
)
