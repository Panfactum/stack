import type { ReactNode } from 'react'
import modules from './terraform-modules/modules.json'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Repo Environment Variables',
    path: '/repo-variables',
  },
  {
    text: '.env Environment Variables',
    path: '/dotenv',
  },
  {
    text: 'Terragrunt Variables',
    path: '/terragrunt-variables',
  },
  {
    text: 'Terraform Modules',
    path: '/terraform-modules',
    sub: [
      {
        text: 'Overview',
        path: '/overview',
      },
    ].concat(modules.modules.map(module => ({
      text: module,
      path: `/${module}`
    })))
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
