import type { ReactNode } from 'react'

import ArticleWithSideNavLayout from '@/components/layout/web/article/withNav/ArticleWithNavLayout'

const SIDENAV_SECTIONS = [
  {
    text: 'Getting Started',
    path: '/getting-started',
    sub: [
      {
        text: 'Start Here',
        path: '/start-here'
      },
      {
        text: 'Overview',
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
        text: 'Configuring Infrastructure-as-Code (IaC)',
        path: '/configuring-infrastructure-as-code'
      },
      {
        text: 'Bootstrapping IaC',
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
        text: 'Databases',
        path: '/databases'
      },
      {
        text: 'Identity Provider',
        path: '/identity-provider'
      },
      {
        text: 'Federated Auth',
        path: '/federated-auth'
      },
      {
        text: 'Review and Next Steps',
        path: '/next-steps'
      }
    ]
  },
  {
    text: 'Stack Addons',
    path: '/addons',
    sub: [
      {
        text: 'Overview',
        path: '/overview'
      },
      {
        text: 'Workflow Engine',
        path: '/workflow-engine',
        sub: [
          {
            text: 'Installing',
            path: '/installing'
          },
          {
            text: 'Creating Workflows',
            path: '/creating-workflows'
          },
          {
            text: 'Triggering Workflows',
            path: '/triggering-workflows'
          },
          {
            text: 'Prebuilt Workflows',
            path: '/prebuilt-workflows'
          },
          {
            text: 'Debugging',
            path: '/debugging'
          }
        ]
      },
      {
        text: 'Event Bus',
        path: '/event-bus',
        sub: [
          {
            text: 'Installing',
            path: '/installing'
          },
          {
            text: 'Use Cases',
            path: '/use-cases'
          }
        ]
      },
      {
        text: 'BuildKit',
        path: '/buildkit',
        sub: [
          {
            text: 'Installing',
            path: '/installing'
          },
          {
            text: 'Building Images',
            path: '/building-images'
          },
          {
            text: 'Debugging',
            path: '/debugging'
          }
        ]
      },
      {
        text: 'GitHub Actions',
        path: '/github-actions',
        sub: [
          {
            text: 'Installing',
            path: '/installing'
          }
        ]
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
    text: 'Infrastructure-as-Code',
    path: '/iac',
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
    text: 'Deploying Workloads',
    path: '/deploying-workloads',
    sub: [
      {
        text: 'Basics',
        path: '/basics'
      },
      {
        text: 'Networking',
        path: '/networking'
      },
      {
        text: 'Persistence',
        path: '/persistence'
      },
      {
        text: 'High Availability',
        path: '/high-availability'
      },
      {
        text: 'Permissions',
        path: '/permissions'
      },
      {
        text: 'Checklist',
        path: '/checklist'
      }
    ]
  },
  {
    text: 'CI / CD',
    path: '/cicd',
    sub: [
      {
        text: 'Getting Started',
        path: '/getting-started'
      },
      {
        text: 'Checking Out Code',
        path: '/checking-out-code'
      },
      {
        text: 'Rolling Deployments',
        path: '/rolling-deployments'
      }
    ]
  },
  {
    text: 'Networking',
    path: '/networking',
    sub: [
      {
        text: 'SSH Tunneling',
        path: '/ssh-tunnel'
      },
      {
        text: 'Database Connections',
        path: '/database-connections'
      }
    ]
  },
  {
    text: 'User Management',
    path: '/user-management',
    sub: [
      {
        text: 'Provisioning',
        path: '/provisioning-new-user'
      },
      {
        text: 'New User Setup',
        path: '/setting-up-new-user'
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
      basePath={'/docs/edge/guides'}
    >
      {children}
    </ArticleWithSideNavLayout>
  )
}
