import type { ReactNode } from 'react'

import modules from '@/app/(web)/docs/reference/infrastructure-modules/modules.json'
import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Releases',
    path: '/releases'
  },
  {
    text: 'Repo Environment Variables',
    path: '/repo-variables'
  },
  {
    text: '.env Environment Variables',
    path: '/dotenv'
  },
  {
    text: '.ssh Configuration',
    path: '/ssh',
    sub: [
      {
        text: 'config.yaml',
        path: '/config-yaml'
      }
    ]
  },
  {
    text: '.aws Configuration',
    path: '/aws',
    sub: [
      {
        text: 'config.yaml',
        path: '/config-yaml'
      }
    ]
  },
  {
    text: 'Terragrunt Variables',
    path: '/terragrunt-variables'
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
