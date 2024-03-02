import {
  useMutation,
  useQueryClient
} from '@tanstack/react-query'

import type { APIServerError } from '@/lib/clients/api/apiFetch'
import { apiPost, apiPut } from '@/lib/clients/api/apiFetch'
import type { CRUDResultType } from '@/lib/hooks/queries/util/CRUDResultType'
import { getOneKey } from '@/lib/hooks/queries/util/RQGetResourceHookFactory'

/************************************************
 * Creates hooks for creating one or many instances
 * of a particular resource
 *
 * Will automatically update the "get" cache of the
 * updated resource will the results
 * **********************************************/
export function RQCreateResourceHookFactory<
  ResultType extends CRUDResultType,
  CreateType extends Partial<ResultType>
> (
  resource: string,
  apiPath: string
) {
  const useCreateOne = () => {
    const queryClient = useQueryClient()
    return useMutation<Partial<ResultType> & CRUDResultType, APIServerError, CreateType>({
      mutationFn: async (body) => {
        const [result] = await apiPost<Array<Partial<ResultType> & CRUDResultType>>(apiPath, [body])
        if (!result) {
          throw new Error(`Nothing returned from useCreateOne for ${resource}`)
        }
        return result
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        const key = getOneKey(resource, data.id)
        queryClient.setQueryData<Partial<ResultType> & CRUDResultType>(
          key,
          data
        )
      }
    })
  }

  const useCreateMany = () => {
    const queryClient = useQueryClient()
    return useMutation<Array<Partial<ResultType> & CRUDResultType>, APIServerError, CreateType[]>({
      mutationFn: async (body) => {
        return apiPut<Array<Partial<ResultType> & CRUDResultType>>(apiPath, body)
      },
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: [resource, 'getList'], exact: false })
        data.forEach(result => {
          const key = getOneKey(resource, result.id)
          queryClient.setQueryData<Partial<ResultType> & CRUDResultType>(
            key,
            oldData => ({ ...oldData, ...result })
          )
        })
      }
    })
  }

  return {
    useCreateOne,
    useCreateMany
  }
}
