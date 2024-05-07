import type { ReactNode } from 'react'

import modules from '@/app/(web)/docs/reference/infrastructure-modules/modules.json'
import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Releases',
    path: '/releases'
  },
  {
    text: 'Configuration',
    path: '/configuration',
    sub: [
      {
        text: 'Devenv Variables',
        path: '/repo-variables'
      },
      {
        text: '.env Variables',
        path: '/dotenv'
      },
      {
        text: 'Terragrunt Variables',
        path: '/terragrunt-variables'
      },
      {
        text: 'SSH Config Files',
        path: '/ssh'
      },
      {
        text: 'AWS Config Files',
        path: '/aws'
      },
      {
        text: 'K8s Config Files',
        path: '/kubernetes'
      }
    ]
  },
  {
    text: 'Infrastructure Modules',
    path: '/infrastructure-modules',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      }
    ].concat(modules.modules.map(module => ({
      text: module,
      path: `/${module}`
    })))
  },
  {
    text: 'Resource Tags',
    path: '/resource-tags'
  },
  {
    text: 'RBAC',
    path: '/rbac'
  }
]

export default function Layout (
  { children } : {children: ReactNode}
) {
  return (
    <ArticleWithSideNavLayout
      navSections={SIDENAV_SECTIONS}
      basePath={'/docs/reference'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
