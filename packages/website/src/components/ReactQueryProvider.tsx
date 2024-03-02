'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { memo } from 'react'

import { queryClient } from '@/lib/clients/query/client'

export default memo(function ReactQueryProvider ({ children }: {children: ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition={'bottom-left'}
      />
    </QueryClientProvider>
  )
})
