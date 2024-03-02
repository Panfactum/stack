import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

import type { APIServerError } from '@/lib/clients/api/apiFetch'
import { apiDelete } from '@/lib/clients/api/apiFetch'
import { getOneKey } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'

type DeletionReply = string[]

/************************************************
 * Creates hooks for deleting one or many instances
 * of a particular resource
 *
 * Will automatically update the "get" cache of the
 * updated resource will the results
 * **********************************************/
export function RQDeleteResourceHookFactory (
  resource: string,
  apiPath: string
) {
  const useDeleteOne = () => {
    const queryClient = useQueryClient()
    return useMutation<DeletionReply, APIServerError, {id: string}>({
      mutationFn: async ({ id }) => {
        return await apiDelete<DeletionReply>(`${apiPath}?ids=${encodeURIComponent(id)}`)
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        data.forEach(id => {
          const key = getOneKey(resource, id)
          if (queryClient.getQueryData(key)) {
            queryClient.setQueryData(
              key,
              undefined
            )
          }
        })
      }
    })
  }

  const useDeleteMany = () => {
    const queryClient = useQueryClient()
    return useMutation<DeletionReply, APIServerError, {ids: string[]}>({
      mutationFn: async ({ ids }) => {
        const params = ids.map(id => `ids=${encodeURIComponent(id)}`).join('&')
        return await apiDelete<DeletionReply>(`${apiPath}?${params}`)
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        data.forEach(id => {
          const key = getOneKey(resource, id)
          if (queryClient.getQueryData(key)) {
            queryClient.setQueryData(
              key,
              undefined
            )
          }
        })
      }
    })
  }

  return {
    useDeleteOne,
    useDeleteMany
  }
}
