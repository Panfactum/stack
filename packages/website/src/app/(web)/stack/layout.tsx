import type { ReactNode } from 'react'

import SecondaryWebLayout from '@/components/layout/web/secondary/SecondaryWebLayout'

const TABS = [
  {
    text: 'Features',
    href: '/stack/features'
  },
  {
    text: 'Pricing',
    href: '/stack/pricing'
  },
  {
    text: 'Demos',
    href: '/stack/demo'
  },
  {
    text: 'Savings Calculator',
    href: '/stack/savings'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <SecondaryWebLayout tabs={TABS}>
      {children}
    </SecondaryWebLayout>
  )
}
