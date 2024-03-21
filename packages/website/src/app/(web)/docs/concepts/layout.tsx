import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Networking',
    path: '/networking',
    sub: [
      {
        text: 'AWS Network Primitives',
        path: '/aws-primitives'
      },
      {
        text: 'Network Address Translation (NAT)',
        path: '/nat'
      },
      {
        text: 'Subdomain Delegation',
        path: '/subdomain-delegation'
      },
      {
        text: 'Kubernetes Networking',
        path: '/cluster-networking'
      },
      {
        text: 'Cryptography',
        path: '/cryptography'
      }
    ]
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <ArticleWithSideNavLayout
      navSections={SIDENAV_SECTIONS}
      basePath={'/docs/concepts'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
