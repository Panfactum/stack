import { useQueryClient } from '@tanstack/react-query'

export default function useRefresh () {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries()
  }
}
