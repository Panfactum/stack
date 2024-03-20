import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Getting Started',
    path: '/getting-started',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      },
      {
        text: 'Local Setup',
        path: '/local-setup'
      },
      {
        text: 'Repository Setup',
        path: '/repo-setup'
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
        text: 'Deploying Modules',
        path: '/deploying-modules'
      },
      {
        text: 'Using Third-Party Modules',
        path: '/third-party-modules'
      },
      {
        text: 'Developing First-Party Modules',
        path: '/first-party-modules'
      },
      {
        text: 'Debugging',
        path: '/debugging'
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
        text: 'Preparing AWS',
        path: '/preparing-aws'
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
        text: 'External Cluster Networking',
        path: '/external-cluster-networking'
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
