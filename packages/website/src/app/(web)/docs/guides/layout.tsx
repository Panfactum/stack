import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Getting Started',
    path: '/getting-started',
    sub: [
      {
        text: 'Start Here',
        path: '/overview'
      },
      {
        text: 'Install Tooling',
        path: '/install-tooling'
      },
      {
        text: 'Boot Developer Environment',
        path: '/boot-developer-environment'
      },
      {
        text: 'Connect to Infrastructure',
        path: '/connect-to-infrastructure'
      }
    ]
  },
  {
    text: 'Bootstrapping Stack',
    path: '/bootstrapping',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      },
      {
        text: 'Installing the Developer Environment',
        path: '/installing-devenv'
      },
      {
        text: 'Preparing AWS',
        path: '/preparing-aws'
      },
      {
        text: 'Configuring Infrastructure-as-Code',
        path: '/configuring-infrastructure-as-code'
      },
      {
        text: 'Bootstrapping Infrastructure-as-Code',
        path: '/infrastructure-as-code'
      },
      {
        text: 'DNS',
        path: '/dns'
      },
      {
        text: 'AWS Networking',
        path: '/aws-networking'
      },
      {
        text: 'Kubernetes Cluster',
        path: '/kubernetes-cluster'
      },
      {
        text: 'Internal Cluster Networking',
        path: '/internal-cluster-networking'
      },
      {
        text: 'Storage Interfaces',
        path: '/storage-interfaces'
      },
      {
        text: 'Vault',
        path: '/vault'
      },
      {
        text: 'Certificate Management',
        path: '/certificate-management'
      },
      {
        text: 'Service Mesh',
        path: '/service-mesh'
      },
      {
        text: 'Autoscaling',
        path: '/autoscaling'
      },
      {
        text: 'Inbound Networking',
        path: '/inbound-networking'
      },
      {
        text: 'Maintenance Controllers',
        path: '/maintenance-controllers'
      },
      {
        text: 'Database Operators',
        path: '/database-operators'
      },
      {
        text: 'Identity Provider',
        path: '/identity-provider'
      },
      {
        text: 'Basic Observability',
        path: '/basic-observability'
      },
      {
        text: 'Testing',
        path: '/testing'
      }
    ]
  },
  {
    text: 'Developer Environment',
    path: '/developer-environment',
    sub: [
      {
        text: 'Customizing',
        path: '/customizing'
      },
      {
        text: 'Debugging',
        path: '/debugging'
      },
      {
        text: 'Editor Setup',
        path: '/editor-setup'
      }
    ]
  },
  {
    text: 'Terraforming',
    path: '/terraforming',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      },
      {
        text: 'Repository Setup',
        path: '/repo-setup'
      },
      {
        text: 'Deploying Modules',
        path: '/deploying-modules'
      },
      {
        text: 'Using Panfactum Modules',
        path: '/panfactum-modules'
      },
      {
        text: 'Developing First-Party Modules',
        path: '/first-party-modules'
      },
      {
        text: 'Extending Panfactum Configuration',
        path: '/extending-panfactum'
      },
      {
        text: 'Debugging',
        path: '/debugging'
      }
    ]
  },
  {
    text: 'Panfactum Versioning',
    path: '/versioning',
    sub: [
      {
        text: 'Releases',
        path: '/releases'
      },
      {
        text: 'Pinning',
        path: '/pinning'
      },
      {
        text: 'Upgrading',
        path: '/upgrading',
        sub: [
          {
            text: 'General Guide',
            path: '/general'
          }
        ]
      }
    ]
  },
  {
    text: 'Contributing',
    path: '/contributing',
    sub: [
      {
        text: 'Getting Started',
        path: '/getting-started'
      },
      {
        text: 'Pull Requests',
        path: '/pull-requests'
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
      basePath={'/docs/guides'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
