import type { StorefrontsFiltersType, StorefrontsResultType, StorefrontsSortType } from '@panfactum/primary-api'

import { RQGetResourceHookFactory } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'

const resource = 'storefront'
const apiPath = '/v1/storefronts'
export const {
  useGetOne: useGetOneStorefront,
  usePrefetchGetOne: usePrefetchGetOneStorefront,
  useGetList: useGetListStorefront,
  usePrefetchGetList: usePrefetchGetListStorefront
} = RQGetResourceHookFactory<
  StorefrontsResultType,
  StorefrontsSortType,
  StorefrontsFiltersType
>(
  resource,
  apiPath
)
