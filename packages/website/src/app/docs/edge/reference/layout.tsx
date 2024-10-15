import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

import modules from './infrastructure-modules/modules.json'

function makeModuleDir (modules: Array<{type: string, group: string, module: string}>, group: string, type: string) {
  return modules
    .filter(module => module.group === group && module.type === type)
    .map(({ module }) => ({
      text: module,
      path: `/${module}`
    }))
}

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
        text: 'Repository Variables',
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
      },
      {
        text: 'BuildKit Config Files',
        path: '/buildkit'
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
        text: 'Direct Modules',
        path: '/direct',
        sub: [
          {
            text: 'AWS',
            path: '/aws',
            sub: makeModuleDir(modules.modules, 'aws', 'direct')
          },
          {
            text: 'Authentik',
            path: '/authentik',
            sub: makeModuleDir(modules.modules, 'authentik', 'direct')
          },
          {
            text: 'Kubernetes',
            path: '/kubernetes',
            sub: makeModuleDir(modules.modules, 'kubernetes', 'direct')
          },
          {
            text: 'Vault',
            path: '/vault',
            sub: makeModuleDir(modules.modules, 'vault', 'direct')
          }
        ]
      },
      {
        text: 'Submodules',
        path: '/submodule',
        sub: [
          {
            text: 'AWS',
            path: '/aws',
            sub: makeModuleDir(modules.modules, 'aws', 'submodule')
          },
          {
            text: 'Kubernetes',
            path: '/kubernetes',
            sub: makeModuleDir(modules.modules, 'kubernetes', 'submodule')
          },
          {
            text: 'Workflows',
            path: '/workflow',
            sub: makeModuleDir(modules.modules, 'workflow', 'submodule')
          }
        ]
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
