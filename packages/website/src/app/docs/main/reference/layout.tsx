import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

import modules from './infrastructure-modules/modules.json'

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
      },
      {
        text: 'AWS',
        path: '/aws',
        sub: modules.modules
          .filter(module => module.group === 'aws')
          .map(({ module }) => ({
            text: module,
            path: `/${module}`
          }))
      },
      {
        text: 'Authentik',
        path: '/authentik',
        sub: modules.modules
          .filter(module => module.group === 'authentik')
          .map(({ module }) => ({
            text: module,
            path: `/${module}`
          }))
      },
      {
        text: 'Kubernetes',
        path: '/kubernetes',
        sub: modules.modules
          .filter(module => module.group === 'kubernetes')
          .map(({ module }) => ({
            text: module,
            path: `/${module}`
          }))
      },
      {
        text: 'Vault',
        path: '/vault',
        sub: modules.modules
          .filter(module => module.group === 'vault')
          .map(({ module }) => ({
            text: module,
            path: `/${module}`
          }))
      },
      {
        text: 'Utility',
        path: '/utility',
        sub: modules.modules
          .filter(module => module.group === 'utility')
          .map(({ module }) => ({
            text: module,
            path: `/${module}`
          }))
      }
    ]
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
      basePath={'/docs/edge/reference'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
