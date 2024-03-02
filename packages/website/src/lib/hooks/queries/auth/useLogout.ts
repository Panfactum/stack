import { useMutation, useQueryClient } from '@tanstack/react-query'

import { postLogout } from '@/lib/clients/api/postLogout'

export function useLogout () {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await postLogout()
    },
    onMutate: () => {
      queryClient.setQueryData(['identity'], undefined)
    }
  })
}
