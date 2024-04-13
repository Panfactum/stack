import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

import modules from './terraform-modules/modules.json'

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
    text: 'Terraform Modules',
    path: '/terraform-modules',
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
