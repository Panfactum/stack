import { useStore } from '@nanostores/react'
import { navigate } from 'astro:transitions/client'
import { GalleryVerticalEnd } from 'lucide-react'
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
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

interface SideNavSection {
  text: string
  path: string
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
    sub: [
      {
        text: 'Releases',
        path: '/releases',
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

export function DocsSidebar({
  currentPath,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const basePath = '/docs'
  const currentBasePath = (currentPath: string) => {
    const [_, docRoot, version, ...pathArr] = currentPath.split('/')

    const isVersionedPath = isValidVersion(version)

    return isVersionedPath ? docRoot + '/' + version : docRoot
  }

  const navRefStore = useStore(sectionLastPath)
  const $docStore = useStore(documentationStore)
  const [$navRefStore, setNavRefStore] = React.useState({})
  const version = $docStore.version
  const isVersioned = currentPath.startsWith(`${basePath}/${version}`)

  React.useEffect(() => {
    setNavRefStore(navRefStore)

    if (currentRoot) {
      setNavigationReferences(currentRoot?.path, currentPath)
    }
  })

  const currentRoot = SIDENAV_SECTIONS.find((item) =>
    currentPath.startsWith(
      `${basePath}${item.notVersioned ? '' : `/${version}`}${item.path}`,
    ),
  )

  const overrideRootUrl = (basePath: string, rootPath: string) => {
    const ref = $navRefStore[rootPath]

    return `${basePath}${ref ? `/${ref}` : rootPath}`
  }

  interface SectionProp extends SideNavSection {
    basePath: string
    clicked: (open: boolean) => void
  }

  const Section = ({
    text,
    path,
    sub,
    basePath = '/',
    clicked,
  }: SectionProp) => {
    const sectionPath = basePath + path
    const isActive = !!(path && currentPath.includes(basePath + path))

    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton asChild isActive={isActive}>
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
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>

        <CollapsibleContent>
          <SidebarMenuSub>
            {sub.map((el) => {
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
                      onClick={clicked}
                      className="text-md"
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
    setVersion(version)

    if (isVersioned) {
      navigate(`${basePath}/${version}/${stripBasePath(currentPath).path}`)
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

  return (
    <Sidebar
      currentPath={currentPath}
      {...props}
      crumbs={crumbs}
      openMobile={openMobile}
      setOpenMobile={setOpenMobile}
    >
      <SidebarHeader className={`gap-y-3xl`}>
        <SidebarMenu>
          <div className={`flex flex-col gap-y-lg`}>
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
        </SidebarMenu>
        <SidebarMenu>
          {SIDENAV_SECTIONS.map((item) => (
            <SidebarMenuItem key={item.text}>
              <SidebarMenuButton
                asChild
                isActive={currentPath.includes(item.path)}
              >
                <a
                  href={overrideRootUrl(
                    `${basePath}${item.notVersioned ? '' : `/${version}`}`,
                    item.path,
                    item.notVersioned,
                  )}
                  onClick={() => setOpenMobile(false)}
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <GalleryVerticalEnd className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{item.text}</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>

      <Spacer />

      <SidebarContent id={`sidebar-scroll`}>
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
                      clicked={() => setOpenMobile(false)}
                    />
                  )
                }

                return (
                  <SidebarMenuItem key={section.text}>
                    <SidebarMenuButton
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
