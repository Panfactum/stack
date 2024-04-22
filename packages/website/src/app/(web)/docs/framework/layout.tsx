import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Framework',
    path: '/framework',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      },
      {
        text: 'KPIs',
        path: '/kpis'
      },
      {
        text: 'Downtime Visibility',
        path: '/downtime-visibility'
      },
      {
        text: 'Security Backlog',
        path: '/security-backlog'
      }

    ]
  },
  {
    text: 'Pillars',
    path: '/pillars',
    sub: [
      {
        text: 'Automation',
        path: '/automation'
      },
      {
        text: 'Observability',
        path: '/observability'
      },
      {
        text: 'Security',
        path: '/security'
      },
      {
        text: 'Resiliency',
        path: '/resiliency'
      },
      {
        text: 'Performance',
        path: '/performance'
      },
      {
        text: 'Immediate Integration',
        path: '/immediate-integration'
      },
      {
        text: 'Efficiency',
        path: '/efficiency'
      },
      {
        text: 'Coordination',
        path: '/coordination'
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
      basePath={'/docs/framework'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
