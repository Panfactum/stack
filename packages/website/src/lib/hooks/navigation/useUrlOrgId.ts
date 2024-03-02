import { usePathname } from 'next/navigation'

const regex = /^\/a\/o\/([A-z0-9-]+)(\/.*)?$/

export default function useUrlOrgId () {
  const path = usePathname()
  const matches = regex.exec(path)
  return matches === null ? null : matches[1] ?? null
}
