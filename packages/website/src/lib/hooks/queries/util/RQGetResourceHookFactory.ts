import type { QueryClient } from '@tanstack/react-query'
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import { apiFetch } from '@/lib/clients/api/apiFetch'
import type { CRUDResultType } from '@/lib/hooks/queries/util/CRUDResultType'
import type { FilterConfig, FilterParamList } from '@/lib/hooks/queries/util/FilterTypes'

/************************************************
 * Helpers
 * **********************************************/
export const getOneKey = (resource: string, id: string) => [resource, 'getOne', id]

export interface ApiGetListResult<Result> {
  data: Result[]
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }
}

export interface GetListParams<ResultType extends CRUDResultType, SortField extends string, Filter extends FilterConfig<ResultType>> {
  sort?: {
    order: 'ASC' | 'DESC'
    field: SortField
  }
  filters?: FilterParamList<ResultType, Filter>
}

/************************************************
 * Creates hooks for getting one or many instances
 * of a particular resource
 *
 * For the "getList" functionality:
 *
 *   - Provides the ability to sort and filter (type checked against API types)
 *   - Results will automatically populate the "getOne" local state to avoid redundant requests
 *   - Pagination is built-in via the infiniteQuery functionality from react-query
 * **********************************************/
export function RQGetResourceHookFactory<
  ResultType extends CRUDResultType,
  SortType extends string,
  FilterType extends FilterConfig<ResultType>
> (
  resource: string,
  apiPath: string
) {
  const createUseGetOneOptions = (
    id: string
  ) => {
    return queryOptions<ResultType>({
      queryKey: getOneKey(resource, id),
      queryFn: async () => {
        const [result] = await apiFetch<ApiGetListResult<ResultType>>(`${apiPath}?id_strEq=${encodeURIComponent(id)}`)
          .then(({ data }) => data)

        if (!result) {
          // TODO: Specify 404 error
          throw new Error(`${resource} ${id} not found`)
        }
        return result
      }
    })
  }

  const useGetOne = (
    id: Parameters<typeof createUseGetOneOptions>[0]
  ) => {
    return useQuery(createUseGetOneOptions(id))
  }

  const usePrefetchGetOne = (
    id: Parameters<typeof createUseGetOneOptions>[0]
  ) => {
    const queryClient = useQueryClient()
    return () => {
      void queryClient.prefetchQuery(createUseGetOneOptions(id))
    }
  }

  const createUseGetListOptions = (
    client: QueryClient,
    params: GetListParams<ResultType, SortType, FilterType> = {},
    options: {
      perPage?: number
    } = {}
  ) => {
    return infiniteQueryOptions<ApiGetListResult<ResultType>>({
      queryKey: [resource, 'getList', params],
      getNextPageParam: (lastPage, _, lastPageParam) => {
        if (lastPage.pageInfo.hasNextPage) {
          return (lastPageParam as number) + 1
        } else {
          return null
        }
      },
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const { sort, filters } = params
        const { perPage = 100 } = options

        // Yes, this is an odd way to build a query string;
        // However, our backend API server requires a very specific
        // spec for query strings
        let queryStringParts: string[] = []
        if (sort !== undefined) {
          queryStringParts = queryStringParts.concat([
            `sortOrder=${encodeURIComponent(sort.order)}`,
            `sortField=${encodeURIComponent(sort.field)}`
          ])
        }
        queryStringParts = queryStringParts.concat([
          `page=${encodeURIComponent((pageParam as number) - 1)}`,
          `perPage=${encodeURIComponent(perPage)}`
        ])

        if (filters !== undefined) {
          queryStringParts = queryStringParts.concat(filters.map(({ field, operator, value }) => {
            if (field === undefined || operator === undefined || value === null || value === undefined) {
              return []
            } else if (Array.isArray(value)) {
              // yes, it is where there are multiples of the same key,
              // but this is what the API server expects
              return (value).map(v => `${encodeURIComponent(field)}${operator ? `_${encodeURIComponent(operator)}` : ''}=${encodeURIComponent(v)}`)
            } else if (typeof value === 'object') {
              throw new Error(`get: filter values cannot be objects ${JSON.stringify(value)}`)
            } else {
              return `${encodeURIComponent(field)}_${encodeURIComponent(operator)}=${encodeURIComponent(value)}`
            }
          }).flat())
        }
        const queryStringWithDelimiter = queryStringParts.length === 0
          ? ''
          : `?${queryStringParts.join('&')}`

        const result = await apiFetch<ApiGetListResult<ResultType>>(`${apiPath}${queryStringWithDelimiter}`)

        result.data.forEach(el => {
          client.setQueryData(getOneKey(resource, el.id), el)
        })

        return result
      }
    })
  }

  const useGetList = (
    params?: Parameters<typeof createUseGetListOptions>[1],
    options?: Parameters<typeof createUseGetListOptions>[2]
  ) => {
    const client = useQueryClient()
    return useInfiniteQuery(createUseGetListOptions(client, params, options))
  }
  const usePrefetchGetList = (
    params?: Parameters<typeof createUseGetListOptions>[1],
    options?: Parameters<typeof createUseGetListOptions>[2]
  ) => {
    const queryClient = useQueryClient()
    return () => {
      void queryClient.prefetchQuery(createUseGetListOptions(queryClient, params, options))
    }
  }

  return {
    useGetOne,
    usePrefetchGetOne,
    useGetList,
    usePrefetchGetList
  }
}
