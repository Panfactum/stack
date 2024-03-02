import { useQuery } from '@tanstack/react-query'

import { fetchAuthInfo } from '@/lib/clients/api/fetchAuthInfo'

export function useIdentity () {
  return useQuery({
    queryKey: ['identity'],
    queryFn: () => {
      return fetchAuthInfo()
    }
  })
}
