import { useContext, useEffect } from 'react'

import { TitleContext } from '@/lib/contexts/app/Title'

export function useSetTitle (header?: string, id?: string) {
  const { setTitle } = useContext(TitleContext)

  useEffect(() => {
    setTitle(header
      ? {
        header,
        id
      }
      : undefined)
  }, [header, id, setTitle])
}
