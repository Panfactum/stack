import { useStore } from '@nanostores/react'
import { navigate } from 'astro:transitions/client'
import * as React from 'react'
import { useState } from 'react'
import { SearchButton } from '@/components/documentation/search/search-button.tsx'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuButtonTreeItem,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/ui/sidebar.tsx'
import Spacer from '@/components/ui/spacer.tsx'
import { DOCS_VERSIONS, isValidVersion } from '@/lib/constants.ts'
import {
  documentationStore,
  sectionLastPath,
  setNavigationReferences,
  setVersion,
  stripBasePath,
} from '@/stores/documentation-store.ts'
import modules from './modules.json'
import {useNavReferenceLink} from "@/hooks/useNavReferenceLink.ts";

function DataFlowIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 19H14.8C13.1198 19 12.2798 19 11.638 18.673C11.0735 18.3854 10.6146 17.9265 10.327 17.362C10 16.7202 10 15.8802 10 14.2V7.8C10 6.11984 10 5.27976 10.327 4.63803C10.6146 4.07354 11.0735 3.6146 11.638 3.32698C12.2798 3 13.1198 3 14.8 3H15M15 19C15 20.1046 15.8954 21 17 21C18.1046 21 19 20.1046 19 19C19 17.8954 18.1046 17 17 17C15.8954 17 15 17.8954 15 19ZM15 3C15 4.10457 15.8954 5 17 5C18.1046 5 19 4.10457 19 3C19 1.89543 18.1046 1 17 1C15.8954 1 15 1.89543 15 3ZM5 11L15 11M5 11C5 12.1046 4.10457 13 3 13C1.89543 13 1 12.1046 1 11C1 9.89543 1.89543 9 3 9C4.10457 9 5 9.89543 5 11ZM15 11C15 12.1046 15.8954 13 17 13C18.1046 13 19 12.1046 19 11C19 9.89543 18.1046 9 17 9C15.8954 9 15 9.89543 15 11Z" stroke="#3B81B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
};

function LightBulbIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.6586V19C9 20.1046 9.89543 21 11 21C12.1046 21 13 20.1046 13 19V16.6586M11 1V2M2 11H1M4.5 4.5L3.8999 3.8999M17.5 4.5L18.1002 3.8999M21 11H20M17 11C17 14.3137 14.3137 17 11 17C7.68629 17 5 14.3137 5 11C5 7.68629 7.68629 5 11 5C14.3137 5 17 7.68629 17 11Z" stroke="#6172F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 19L10.8999 18.8499C10.2053 17.808 9.85798 17.287 9.3991 16.9098C8.99286 16.5759 8.52476 16.3254 8.02161 16.1726C7.45325 16 6.82711 16 5.57482 16H4.2C3.07989 16 2.51984 16 2.09202 15.782C1.71569 15.5903 1.40973 15.2843 1.21799 14.908C1 14.4802 1 13.9201 1 12.8V4.2C1 3.07989 1 2.51984 1.21799 2.09202C1.40973 1.71569 1.71569 1.40973 2.09202 1.21799C2.51984 1 3.07989 1 4.2 1H4.6C6.84021 1 7.96031 1 8.81596 1.43597C9.56861 1.81947 10.1805 2.43139 10.564 3.18404C11 4.03968 11 5.15979 11 7.4M11 19V7.4M11 19L11.1001 18.8499C11.7947 17.808 12.142 17.287 12.6009 16.9098C13.0071 16.5759 13.4752 16.3254 13.9784 16.1726C14.5467 16 15.1729 16 16.4252 16H17.8C18.9201 16 19.4802 16 19.908 15.782C20.2843 15.5903 20.5903 15.2843 20.782 14.908C21 14.4802 21 13.9201 21 12.8V4.2C21 3.07989 21 2.51984 20.782 2.09202C20.5903 1.71569 20.2843 1.40973 19.908 1.21799C19.4802 1 18.9201 1 17.8 1H17.4C15.1598 1 14.0397 1 13.184 1.43597C12.4314 1.81947 11.8195 2.43139 11.436 3.18404C11 4.03968 11 5.15979 11 7.4" stroke="#E478FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function AnalyzeIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 9.5V5.8C17 4.11984 17 3.27976 16.673 2.63803C16.3854 2.07354 15.9265 1.6146 15.362 1.32698C14.7202 1 13.8802 1 12.2 1H5.8C4.11984 1 3.27976 1 2.63803 1.32698C2.07354 1.6146 1.6146 2.07354 1.32698 2.63803C1 3.27976 1 4.11984 1 5.8V16.2C1 17.8802 1 18.7202 1.32698 19.362C1.6146 19.9265 2.07354 20.3854 2.63803 20.673C3.27976 21 4.11984 21 5.8 21H8.5M19 21L17.5 19.5M18.5 17C18.5 18.933 16.933 20.5 15 20.5C13.067 20.5 11.5 18.933 11.5 17C11.5 15.067 13.067 13.5 15 13.5C16.933 13.5 18.5 15.067 18.5 17Z" stroke="#FF9C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface SideNavSection {
  text: string
  path: string
  icon: () => any,
  notVersioned?: boolean
  default?: boolean
  sub?: SideNavSection[]
  isActive?: boolean
}

function makeModuleDir(
  modules: Array<{ type: string; group: string; module: string }>,
  group: string,
  type: string,
) {
  return modules
    .filter((module) => module.group === group && module.type === type)
    .map(({ module }) => ({
      text: module,
      path: `/${module}`,
    }))
}

const SIDENAV_SECTIONS: SideNavSection[] = [
  {
    text: 'Framework',
    path: '/framework',
    icon: DataFlowIcon,
    notVersioned: true,
    sub: [
      {
        text: 'Framework',
        path: '/framework',
        sub: [
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'KPIs',
            path: '/kpis',
          },
          {
            text: 'Downtime Visibility',
            path: '/downtime-visibility',
          },
          {
            text: 'Security Backlog',
            path: '/security-backlog',
          },
        ],
      },
      {
        text: 'Pillars',
        path: '/pillars',
        sub: [
          {
            text: 'Automation',
            path: '/automation',
          },
          {
            text: 'Observability',
            path: '/observability',
          },
          {
            text: 'Security',
            path: '/security',
          },
          {
            text: 'Resiliency',
            path: '/resiliency',
          },
          {
            text: 'Performance',
            path: '/performance',
          },
          {
            text: 'Immediate Integration',
            path: '/immediate-integration',
          },
          {
            text: 'Efficiency',
            path: '/efficiency',
          },
          {
            text: 'Coordination',
            path: '/coordination',
          },
        ],
      },
    ],
  },
  {
    text: 'Concepts',
    path: '/concepts',
    icon: LightBulbIcon,
    sub: [
      {
        text: 'Infrastructure-as-Code',
        path: '/iac',
      },
      {
        text: 'Networking',
        path: '/networking',
        sub: [
          {
            text: 'Cryptography',
            path: '/cryptography',
          },
          {
            text: 'AWS Network Primitives',
            path: '/aws-primitives',
          },
          {
            text: 'Network Address Translation (NAT)',
            path: '/nat',
          },
          {
            text: 'Subdomain Delegation',
            path: '/subdomain-delegation',
          },
          {
            text: 'Kubernetes Networking',
            path: '/cluster-networking',
          },
        ],
      },
      {
        text: 'Autoscaling',
        path: '/autoscaling',
      },
      {
        text: 'BuildKit',
        path: '/buildkit',
      },
      {
        text: 'CI / CD',
        path: '/cicd',
        sub: [
          {
            text: 'Recommended Architecture',
            path: '/recommended-architecture',
          },
          {
            text: 'GHA',
            path: '/gha',
          },
        ],
      },
    ],
  },
  {
    text: 'Guides',
    path: '/guides',
    icon: BookIcon,
    sub: [
      {
        text: 'Getting Started',
        path: '/getting-started',
        sub: [
          {
            text: 'Start Here',
            path: '/start-here',
          },
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'Install Tooling',
            path: '/install-tooling',
          },
          {
            text: 'Boot Developer Environment',
            path: '/boot-developer-environment',
          },
          {
            text: 'Connect to Infrastructure',
            path: '/connect-to-infrastructure',
          },
        ],
      },
      {
        text: 'Bootstrapping Stack',
        path: '/bootstrapping',
        sub: [
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'Installing the Development Shell',
            path: '/installing-devshell',
          },
          {
            text: 'Preparing AWS',
            path: '/preparing-aws',
          },
          {
            text: 'Configuring Infrastructure-as-Code (IaC)',
            path: '/configuring-infrastructure-as-code',
          },
          {
            text: 'Bootstrapping IaC',
            path: '/infrastructure-as-code',
          },
          {
            text: 'DNS',
            path: '/dns',
          },
          {
            text: 'AWS Networking',
            path: '/aws-networking',
          },
          {
            text: 'Kubernetes Cluster',
            path: '/kubernetes-cluster',
          },
          {
            text: 'Internal Cluster Networking',
            path: '/internal-cluster-networking',
          },
          {
            text: 'Policy Controller',
            path: '/policy-controller',
          },
          {
            text: 'Storage Interfaces',
            path: '/storage-interfaces',
          },
          {
            text: 'Vault',
            path: '/vault',
          },
          {
            text: 'Certificate Management',
            path: '/certificate-management',
          },
          {
            text: 'Service Mesh',
            path: '/service-mesh',
          },
          {
            text: 'Autoscaling',
            path: '/autoscaling',
          },
          {
            text: 'Inbound Networking',
            path: '/inbound-networking',
          },
          {
            text: 'Maintenance Controllers',
            path: '/maintenance-controllers',
          },
          {
            text: 'Databases',
            path: '/databases',
          },
          {
            text: 'Identity Provider',
            path: '/identity-provider',
          },
          {
            text: 'Federated Auth',
            path: '/federated-auth',
          },
          {
            text: 'Review and Next Steps',
            path: '/next-steps',
          },
        ],
      },
      {
        text: 'Stack Addons',
        path: '/addons',
        sub: [
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'Workflow Engine',
            path: '/workflow-engine',
            sub: [
              {
                text: 'Installing',
                path: '/installing',
              },
              {
                text: 'Creating Workflows',
                path: '/creating-workflows',
              },
              {
                text: 'Triggering Workflows',
                path: '/triggering-workflows',
              },
              {
                text: 'Prebuilt Workflows',
                path: '/prebuilt-workflows',
              },
              {
                text: 'Debugging',
                path: '/debugging',
              },
            ],
          },
          {
            text: 'Event Bus',
            path: '/event-bus',
            sub: [
              {
                text: 'Installing',
                path: '/installing',
              },
              {
                text: 'Use Cases',
                path: '/use-cases',
              },
            ],
          },
          {
            text: 'BuildKit',
            path: '/buildkit',
            sub: [
              {
                text: 'Installing',
                path: '/installing',
              },
              {
                text: 'Building Images',
                path: '/building-images',
              },
              {
                text: 'Debugging',
                path: '/debugging',
              },
            ],
          },
          {
            text: 'GitHub Actions',
            path: '/github-actions',
            sub: [
              {
                text: 'Installing',
                path: '/installing',
              },
            ],
          },
        ],
      },
      {
        text: 'Development Shell',
        path: '/development-shell',
        sub: [
          {
            text: 'Customizing',
            path: '/customizing',
          },
          {
            text: 'Debugging',
            path: '/debugging',
          },
        ],
      },
      {
        text: 'Infrastructure-as-Code',
        path: '/iac',
        sub: [
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'Repository Setup',
            path: '/repo-setup',
          },
          {
            text: 'Deploying Modules',
            path: '/deploying-modules',
          },
          {
            text: 'Developing First-Party Modules',
            path: '/first-party-modules',
          },
          {
            text: 'Extending Panfactum Configuration',
            path: '/extending-panfactum',
          },
          {
            text: 'Debugging',
            path: '/debugging',
          },
        ],
      },
      {
        text: 'Deploying Workloads',
        path: '/deploying-workloads',
        sub: [
          {
            text: 'Basics',
            path: '/basics',
          },
          {
            text: 'Networking',
            path: '/networking',
          },
          {
            text: 'Persistence',
            path: '/persistence',
          },
          {
            text: 'High Availability',
            path: '/high-availability',
          },
          {
            text: 'Permissions',
            path: '/permissions',
          },
          {
            text: 'Checklist',
            path: '/checklist',
          },
        ],
      },
      {
        text: 'CI / CD',
        path: '/cicd',
        sub: [
          {
            text: 'Getting Started',
            path: '/getting-started',
          },
          {
            text: 'Checking Out Code',
            path: '/checking-out-code',
          },
          {
            text: 'Rolling Deployments',
            path: '/rolling-deployments',
          },
        ],
      },
      {
        text: 'Networking',
        path: '/networking',
        sub: [
          {
            text: 'SSH Tunneling',
            path: '/ssh-tunnel',
          },
          {
            text: 'Database Connections',
            path: '/database-connections',
          },
        ],
      },
      {
        text: 'User Management',
        path: '/user-management',
        sub: [
          {
            text: 'Provisioning',
            path: '/provisioning-new-user',
          },
          {
            text: 'New User Setup',
            path: '/setting-up-new-user',
          },
        ],
      },
      {
        text: 'Panfactum Versioning',
        path: '/versioning',
        sub: [
          {
            text: 'Releases',
            path: '/releases',
          },
          {
            text: 'Pinning',
            path: '/pinning',
          },
          {
            text: 'Upgrading',
            path: '/upgrading',
            sub: [
              {
                text: 'General Guide',
                path: '/general',
              },
            ],
          },
        ],
      },
      {
        text: 'Contributing',
        path: '/contributing',
        sub: [
          {
            text: 'Getting Started',
            path: '/getting-started',
          },
          {
            text: 'Pull Requests',
            path: '/pull-requests',
          },
        ],
      },
    ],
  },
  {
    text: 'Reference',
    path: '/reference',
    icon: AnalyzeIcon,
    sub: [
      {
        text: 'Releases',
        path: '/releases',
        sub: [
          {
            text: 'Supported Releases',
            path: '/supported-releases',
          },
          {
            text: 'Change Log',
            path: '/changelog',
            sub: [
              {
                text: 'Edge',
                path: '/edge',
              },
              {
                text: '24.04',
                path: '/24-05',
              }
            ]
          },
          {
            text: 'Roadmap',
            path: '/roadmap',
          }
        ]
      },
      {
        text: 'Configuration',
        path: '/configuration',
        sub: [
          {
            text: 'Repository Variables',
            path: '/repo-variables',
          },
          {
            text: '.env Variables',
            path: '/dotenv',
          },
          {
            text: 'Terragrunt Variables',
            path: '/terragrunt-variables',
          },
          {
            text: 'SSH Config Files',
            path: '/ssh',
          },
          {
            text: 'AWS Config Files',
            path: '/aws',
          },
          {
            text: 'K8s Config Files',
            path: '/kubernetes',
          },
          {
            text: 'BuildKit Config Files',
            path: '/buildkit',
          },
        ],
      },
      {
        text: 'Infrastructure Modules',
        path: '/infrastructure-modules',
        sub: [
          {
            text: 'Overview',
            path: '/overview',
          },
          {
            text: 'Direct Modules',
            path: '/direct',
            sub: [
              {
                text: 'AWS',
                path: '/aws',
                sub: makeModuleDir(modules.modules, 'aws', 'direct'),
              },
              {
                text: 'Authentik',
                path: '/authentik',
                sub: makeModuleDir(modules.modules, 'authentik', 'direct'),
              },
              {
                text: 'Kubernetes',
                path: '/kubernetes',
                sub: makeModuleDir(modules.modules, 'kubernetes', 'direct'),
              },
              {
                text: 'Vault',
                path: '/vault',
                sub: makeModuleDir(modules.modules, 'vault', 'direct'),
              },
            ],
          },
          {
            text: 'Submodules',
            path: '/submodule',
            sub: [
              {
                text: 'AWS',
                path: '/aws',
                sub: makeModuleDir(modules.modules, 'aws', 'submodule'),
              },
              {
                text: 'Kubernetes',
                path: '/kubernetes',
                sub: makeModuleDir(modules.modules, 'kubernetes', 'submodule'),
              },
              {
                text: 'Workflows',
                path: '/workflow',
                sub: makeModuleDir(modules.modules, 'workflow', 'submodule'),
              },
            ],
          },
        ],
      },
      {
        text: 'Resource Tags',
        path: '/resource-tags',
      },
      {
        text: 'RBAC',
        path: '/rbac',
      },
    ],
  },
]

export const SavedLink: React.FC = ({href, ...props}) => {
  const {link} = useNavReferenceLink(href)


  return (
      <a
          href={link}
          {...props}
      >

      </a>
  )
}


export function DocsSidebar({
  currentPath,
  basePath,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const currentBasePath = (currentPath: string) => {
    const [_, docRoot, version, ...pathArr] = currentPath.split('/')

    const isVersionedPath = isValidVersion(version)

    return isVersionedPath ? docRoot + '/' + version : docRoot
  }

  const $navRefStore = useStore(sectionLastPath)
  const $docStore = useStore(documentationStore)
  // const [$navRefStore, setNavRefStore] = React.useState({})
  const version = $docStore.version

  console.log('version', version, $docStore)

  const isVersioned = currentPath.startsWith(`${basePath}/${version}`)

  const {path} = stripBasePath(currentPath)

  const currentRoot = SIDENAV_SECTIONS.find((item) => ('/' + path).startsWith(item.path))

  const overrideRootUrl = (basePath: string, rootPath: string) => {
    const { path, version, isVersionedPath } = stripBasePath(basePath)

    const sectionKey = `${isVersionedPath ? version: ''}${rootPath}`
    const ref = $navRefStore[sectionKey]

    return `${basePath}${ref ? `/${ref}` : rootPath}`
  }

  interface SectionProp extends SideNavSection {
    basePath: string
    isChild?: boolean;
  }

  React.useEffect(() => {
    // setNavRefStore(navRefStore)

    if (currentRoot) {
      setNavigationReferences(currentRoot?.path, currentPath)
    }
  }, [currentPath, currentRoot])

  const Section = ({
    text,
    path,
    sub,
    basePath = '/',
    isChild = false
  }: SectionProp) => {
    const sectionPath = basePath + path
    const isActive = !!(path && currentPath.includes(basePath + path))

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButtonTreeItem asChild isActive={isActive} >
              <div>
                <span className="font-semibold">{text}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="lucide lucide-chevron-right transition-transform ml-auto group-data-[state=open]/collapsible:rotate-90"
                >
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </div>
            </SidebarMenuButtonTreeItem>
          </CollapsibleTrigger>
        </SidebarMenuItem>

        
          <CollapsibleContent>
            <SidebarMenuSub className="pl-6">
              {sub && sub.map((el) => {
                if (el.sub) {
                  return <Section key={el.text} {...el} basePath={sectionPath} />
                }

                const isActive = !!(
                  el.path && currentPath.includes(sectionPath + el.path)
                )

                return (
                  <SidebarMenuItem key={el.text}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <a
                        href={sectionPath + el.path}
                        className="text-md"
                        onClick={() => setOpenMobile(false)}
                      >
                        {el.text}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenuSub>
          </CollapsibleContent>

        
      </Collapsible>
    )
  }

  const handleVersionChange = (version: string) => {
    if (isVersioned) {
      navigate(`${basePath}/${version}/${stripBasePath(currentPath).path}`)
    } else {
      setVersion(version)
    }
  }

  function buildBreadcrumbs(
    sections: SideNavSection[],
    path: string,
  ): string[] {
    for (const section of sections) {
      if (path.startsWith(section.path)) {
        if (section.sub) {
          const newPath = path.substring(section.path.length)
          return [section.text].concat(buildBreadcrumbs(section.sub, newPath))
        } else {
          return [section.text]
        }
      }
    }
    return []
  }

  const strippedPath = stripBasePath(currentPath)

  const crumbs = buildBreadcrumbs(SIDENAV_SECTIONS, '/' + strippedPath.path)
  const [openMobile, setOpenMobile] = useState(false)

  const mainNavigationLinkActive = (path: string) => {
    return !!(path && currentPath.includes(path))
  }

  return (
    <Sidebar
      id={`sidebar-scroll`}
      currentPath={currentPath}
      {...props}
      crumbs={crumbs}
      openMobile={openMobile}
      setOpenMobile={setOpenMobile}
    >
       <SidebarContent>
          <SidebarMenu className="relative pb-20">
            <div className={`flex flex-col gap-y-lg p-4 sticky h-full top-0 bg-primary z-top-navigation`}>
              <Select
                value={$docStore.version}
                onValueChange={handleVersionChange}
              >
                <SelectTrigger className="border-secondary h-[46px]">
                  <SelectValue placeholder="Theme" value={$docStore.version} />
                </SelectTrigger>
                <SelectContent>
                  {DOCS_VERSIONS.map((version) => (
                    <SelectItem key={version.slug} value={version.slug}>
                      {version.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchButton />
            </div>

            {SIDENAV_SECTIONS.map((item) => (
              <SidebarMenuItem key={item.text}>
                <SidebarMenuButton
                  className="h-[44px] active:bg-white"
                  isActive={mainNavigationLinkActive(item.path)}
                  asChild
                >
                  <SavedLink href={`${basePath}${item.notVersioned ? '' : `/${version}`}${item.path}`} onClick={() => setOpenMobile(false)}>
                    <div
                        className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      {item.icon()}
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">{item.text}</span>
                    </div>
                  </SavedLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            
        

        <Spacer />

        {currentRoot && (
          <SidebarGroup>
            <SidebarMenu>
              {currentRoot.sub.map((section) => {
                const sectionBasePath = `${basePath}${currentRoot.notVersioned ? '' : `/${version}`}${currentRoot.path}`

                if (section.sub) {
                  return (
                    <Section
                      key={section.text}
                      {...section}
                      basePath={sectionBasePath}
                    />
                  )
                }

                return (
                  <SidebarMenuItem key={section.text}>
                    <SidebarMenuButtonTreeItem
                      asChild
                      isActive={currentPath.includes(section.path)}
                    >
                      <a
                        href={sectionBasePath + section.path}
                        onClick={() => setOpenMobile(false)}
                        className="font-medium"
                      >
                        {section.text}
                      </a>
                    </SidebarMenuButtonTreeItem>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
