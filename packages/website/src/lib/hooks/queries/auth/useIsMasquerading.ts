import { useIdentity } from '@/lib/hooks/queries/auth/useIdentity'

export default function useIsMasquerading () {
  const { data: identity } = useIdentity()
  return Boolean(identity && identity.masqueradingUserId)
}
