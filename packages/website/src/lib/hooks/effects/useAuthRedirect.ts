import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useAuthRedirect (isAuthenticated: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      void router.push('/login')
    }
  }, [isAuthenticated, router])
}
