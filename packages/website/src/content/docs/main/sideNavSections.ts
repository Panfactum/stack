import {makeModuleDir} from "@/pages/docs/_components/util/makeModuleDir.ts";

import modules from "./modules.json";
import {
  NavIcons,
  type TopLevelDocsSectionMetadata,
} from "../../../pages/docs/_components/types.ts";

export const SIDENAV_SECTIONS: TopLevelDocsSectionMetadata[] = [
  {
    text: "Concepts",
    path: "/concepts",
    icon: NavIcons.lightBulb,
    sub: [
      {
        text: "Infrastructure-as-Code",
        path: "/iac",
      },
      {
        text: "Networking",
        path: "/networking",
        sub: [
          {
            text: "Cryptography",
            path: "/cryptography",
          },
          {
            text: "AWS Network Primitives",
            path: "/aws-primitives",
          },
          {
            text: "Network Address Translation (NAT)",
            path: "/nat",
          },
          {
            text: "Subdomain Delegation",
            path: "/subdomain-delegation",
          },
          {
            text: "Kubernetes Networking",
            path: "/cluster-networking",
          },
        ],
      },
      {
        text: "Autoscaling",
        path: "/autoscaling",
      },
      {
        text: "BuildKit",
        path: "/buildkit",
      },
      {
        text: "CI / CD",
        path: "/cicd",
        sub: [
          {
            text: "Recommended Architecture",
            path: "/recommended-architecture",
          },
          {
            text: "GHA",
            path: "/gha",
          },
        ],
      },
    ],
  },
  {
    text: "Guides",
    path: "/guides",
    icon: NavIcons.book,
    sub: [
      {
        text: "Getting Started",
        path: "/"
      },
      {
        text: "devShell Setup",
        path: "/getting-started",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Install Tooling",
            path: "/install-tooling",
          },
          {
            text: "Boot Developer Environment",
            path: "/boot-developer-environment",
          },
          {
            text: "Connect to Infrastructure",
            path: "/connect-to-infrastructure",
          },
        ],
      },
      {
        text: "Bootstrapping Guide",
        path: "/bootstrapping",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Installing the Development Shell",
            path: "/installing-devshell",
          },
          {
            text: "Preparing AWS",
            path: "/preparing-aws",
          },
          {
            text: "Configuring IaC",
            path: "/configuring-infrastructure-as-code",
          },
          {
            text: "Bootstrapping IaC",
            path: "/infrastructure-as-code",
          },
          {
            text: "DNS",
            path: "/dns",
          },
          {
            text: "AWS Networking",
            path: "/aws-networking",
          },
          {
            text: "Kubernetes Cluster",
            path: "/kubernetes-cluster",
          },
          {
            text: "Internal Cluster Networking",
            path: "/internal-cluster-networking",
          },
          {
            text: "Policy Controller",
            path: "/policy-controller",
          },
          {
            text: "Storage Interfaces",
            path: "/storage-interfaces",
          },
          {
            text: "Vault",
            path: "/vault",
          },
          {
            text: "Certificate Management",
            path: "/certificate-management",
          },
          {
            text: "Service Mesh",
            path: "/service-mesh",
          },
          {
            text: "Autoscaling",
            path: "/autoscaling",
          },
          {
            text: "Inbound Networking",
            path: "/inbound-networking",
          },
          {
            text: "Maintenance Controllers",
            path: "/maintenance-controllers",
          },
          {
            text: "Databases",
            path: "/databases",
          },
          {
            text: "Identity Provider",
            path: "/identity-provider",
          },
          {
            text: "Federated Auth",
            path: "/federated-auth",
          },
          {
            text: "Review and Next Steps",
            path: "/next-steps",
          },
        ],
      },
      {
        text: "Stack Addons",
        path: "/addons",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Workflow Engine",
            path: "/workflow-engine",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Creating Workflows",
                path: "/creating-workflows",
              },
              {
                text: "Triggering Workflows",
                path: "/triggering-workflows",
              },
              {
                text: "Prebuilt Workflows",
                path: "/prebuilt-workflows",
              },
              {
                text: "Debugging",
                path: "/debugging",
              },
            ],
          },
          {
            text: "Event Bus",
            path: "/event-bus",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Use Cases",
                path: "/use-cases",
              },
            ],
          },
          {
            text: "BuildKit",
            path: "/buildkit",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
              {
                text: "Building Images",
                path: "/building-images",
              },
              {
                text: "Debugging",
                path: "/debugging",
              },
            ],
          },
          {
            text: "GitHub Actions",
            path: "/github-actions",
            sub: [
              {
                text: "Installing",
                path: "/installing",
              },
            ],
          },
        ],
      },
      {
        text: "Development Shell",
        path: "/development-shell",
        sub: [
          {
            text: "Customizing",
            path: "/customizing",
          },
          {
            text: "Debugging",
            path: "/debugging",
          },
        ],
      },
      {
        text: "Infrastructure-as-Code",
        path: "/iac",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Repository Setup",
            path: "/repo-setup",
          },
          {
            text: "Deploying Modules",
            path: "/deploying-modules",
          },
          {
            text: "Developing First-Party Modules",
            path: "/first-party-modules",
          },
          {
            text: "Extending Panfactum Configuration",
            path: "/extending-panfactum",
          },
          {
            text: "Debugging",
            path: "/debugging",
          },
        ],
      },
      {
        text: "Deploying Workloads",
        path: "/deploying-workloads",
        sub: [
          {
            text: "Basics",
            path: "/basics",
          },
          {
            text: "Networking",
            path: "/networking",
          },
          {
            text: "Persistence",
            path: "/persistence",
          },
          {
            text: "High Availability",
            path: "/high-availability",
          },
          {
            text: "Permissions",
            path: "/permissions",
          },
          {
            text: "Checklist",
            path: "/checklist",
          },
        ],
      },
      {
        text: "CI / CD",
        path: "/cicd",
        sub: [
          {
            text: "Getting Started",
            path: "/getting-started",
          },
          {
            text: "Checking Out Code",
            path: "/checking-out-code",
          },
          {
            text: "Rolling Deployments",
            path: "/rolling-deployments",
          },
        ],
      },
      {
        text: "Networking",
        path: "/networking",
        sub: [
          {
            text: "SSH Tunneling",
            path: "/ssh-tunnel",
          },
          {
            text: "Database Connections",
            path: "/database-connections",
          },
        ],
      },
      {
        text: "User Management",
        path: "/user-management",
        sub: [
          {
            text: "Provisioning",
            path: "/provisioning-new-user",
          },
          {
            text: "New User Setup",
            path: "/setting-up-new-user",
          },
        ],
      },
      {
        text: "Panfactum Versioning",
        path: "/versioning",
        sub: [
          {
            text: "Releases",
            path: "/releases",
          },
          {
            text: "Pinning",
            path: "/pinning",
          },
          {
            text: "Upgrading",
            path: "/upgrading",
            sub: [
              {
                text: "General Guide",
                path: "/general",
              },
            ],
          },
        ],
      },
      {
        text: "Contributing",
        path: "/contributing",
        sub: [
          {
            text: "Getting Started",
            path: "/getting-started",
          },
          {
            text: "Pull Requests",
            path: "/pull-requests",
          },
        ],
      },
    ],
  },
  {
    text: "Reference",
    path: "/reference",
    icon: NavIcons.analyze,
    sub: [
      {
        text: "Configuration",
        path: "/configuration",
        sub: [
          {
            text: "Repository Variables",
            path: "/repo-variables",
          },
          {
            text: ".env Variables",
            path: "/dotenv",
          },
          {
            text: "Terragrunt Variables",
            path: "/terragrunt-variables",
          },
          {
            text: "SSH Config Files",
            path: "/ssh",
          },
          {
            text: "AWS Config Files",
            path: "/aws",
          },
          {
            text: "K8s Config Files",
            path: "/kubernetes",
          },
          {
            text: "BuildKit Config Files",
            path: "/buildkit",
          },
        ],
      },
      {
        text: "Infrastructure Modules",
        path: "/infrastructure-modules",
        sub: [
          {
            text: "Overview",
            path: "/overview",
          },
          {
            text: "Direct Modules",
            path: "/direct",
            sub: [
              {
                text: "AWS",
                path: "/aws",
                sub: makeModuleDir(modules.modules, "aws", "direct"),
              },
              {
                text: "Authentik",
                path: "/authentik",
                sub: makeModuleDir(modules.modules, "authentik", "direct"),
              },
              {
                text: "Kubernetes",
                path: "/kubernetes",
                sub: makeModuleDir(modules.modules, "kubernetes", "direct"),
              },
              {
                text: "Vault",
                path: "/vault",
                sub: makeModuleDir(modules.modules, "vault", "direct"),
              },
            ],
          },
          {
            text: "Submodules",
            path: "/submodule",
            sub: [
              {
                text: "AWS",
                path: "/aws",
                sub: makeModuleDir(modules.modules, "aws", "submodule"),
              },
              {
                text: "Kubernetes",
                path: "/kubernetes",
                sub: makeModuleDir(modules.modules, "kubernetes", "submodule"),
              },
              {
                text: "Workflows",
                path: "/workflow",
                sub: makeModuleDir(modules.modules, "workflow", "submodule"),
              },
            ],
          },
        ],
      },
      {
        text: "Resource Tags",
        path: "/resource-tags",
      },
      {
        text: "RBAC",
        path: "/rbac",
      },
    ],
  },
  {
    text: "Changelog",
    path: "/changelog",
    icon: NavIcons.history,
    notVersioned: true,
    sub: [
      {
        text: "Edge",
        path: "/edge",
      }
    ],
  },
  {
    text: "Maturity Model",
    path: "/maturity",
    icon: NavIcons.dataFlow,
    notVersioned: true,
    sub: [
      {
        text: "Overview",
        path: "/"
      },
      {
        text: "Measures",
        path: "/measures",
        sub: [
          {
            text: "KPIs",
            path: "/kpis",
          },
          {
            text: "Downtime Visibility",
            path: "/downtime-visibility",
          },
          {
            text: "Security Backlog",
            path: "/security-backlog",
          },
        ],
      },
      {
        text: "Pillars",
        path: "/pillars",
        sub: [
          {
            text: "Automation",
            path: "/automation",
          },
          {
            text: "Observability",
            path: "/observability",
          },
          {
            text: "Security",
            path: "/security",
          },
          {
            text: "Resiliency",
            path: "/resiliency",
          },
          {
            text: "Performance",
            path: "/performance",
          },
          {
            text: "Immediate Integration",
            path: "/immediate-integration",
          },
          {
            text: "Efficiency",
            path: "/efficiency",
          },
          {
            text: "Coordination",
            path: "/coordination",
          },
        ],
      },
    ],
  },
];
