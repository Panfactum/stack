import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

import type { APIServerError } from '@/lib/clients/api/apiFetch'
import { apiPut } from '@/lib/clients/api/apiFetch'
import type { CRUDResultType } from '@/lib/hooks/queries/util/CRUDResultType'
import { getOneKey } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'
/************************************************
 * Creates hooks for updating one or many instances
 * of a particular resource
 *
 * Will automatically update the "get" cache of the
 * updated resource will the results
 * **********************************************/
export function RQUpdateResourceHookFactory<
  ResultType extends CRUDResultType,
  UpdateDelta extends Partial<ResultType>
> (
  resource: string,
  apiPath: string
) {
  const useUpdateOne = () => {
    const queryClient = useQueryClient()
    return useMutation<Partial<ResultType> & CRUDResultType, APIServerError, {id: string, delta: UpdateDelta}>({
      mutationFn: async ({ id, delta }) => {
        const [result] = await apiPut<Array<Partial<ResultType> & CRUDResultType>>(apiPath, { ids: [id], delta })
        if (!result) {
          throw new Error(`Nothing returned from useUpdateOne for ${resource}`)
        }
        return result
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        const key = getOneKey(resource, data.id)
        if (queryClient.getQueryData(key)) {
          queryClient.setQueryData<Partial<ResultType> & CRUDResultType>(
            key,
            oldData => ({ ...oldData, ...data })
          )
        }
      }
    })
  }

  const useUpdateMany = () => {
    const queryClient = useQueryClient()
    return useMutation<Array<Partial<ResultType> & CRUDResultType>, APIServerError, {ids: string[], delta: UpdateDelta}>({
      mutationFn: async ({ ids, delta }) => {
        return apiPut<Array<Partial<ResultType> & CRUDResultType>>(apiPath, { ids, delta })
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        data.forEach(result => {
          const key = getOneKey(resource, result.id)
          if (queryClient.getQueryData(key)) {
            queryClient.setQueryData<Partial<ResultType> & CRUDResultType>(
              key,
              oldData => ({ ...oldData, ...result })
            )
          }
        })
      }
    })
  }

  return {
    useUpdateOne,
    useUpdateMany
  }
}
