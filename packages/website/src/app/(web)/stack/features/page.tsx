import type { Metadata } from 'next'
import React from 'react'

import FeatureList from '@/app/(web)/stack/features/components/FeatureList'
import StatusChip from '@/app/(web)/stack/features/components/StatusChip'
import Balancer from '@/components/ui/Balancer'

export const metadata: Metadata = {
  title: 'Features'
}

export default function Page () {
  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto py-10 min-h-[90vh] px-4">
      <h1 className="w-full text-3xl sm:text-5xl mb-3 text-center">
        Panfactum Stack Features
      </h1>
      <p className="w-full mb-3 text-center italic">
        <Balancer>Feature statuses represent the state as of the last edge release</Balancer>
      </p>
      <div className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden">

        <FeatureList
          title="Infrastructure-as-Code (IaC)"
          features={[
            { title: '100+ OpenTofu (Terraform) Modules', status: 'stable' },
            {
              title: 'Deployment Management',
              description: 'Supercharge your IaC deployments with our integrated Terragrunt configurations',
              status: 'stable'
            },
            { title: 'Secrets Management', description: 'Provided by sops', status: 'stable' },
            {
              title: 'Repository Scaffolding',
              description: 'Use a single command to automatic set up your repo to begin deploying IaC',
              status: 'stable'
            },
            {
              title: 'Automatic Updates',
              description: 'Automatically ensure that your IaC setup incorporates the latest code and best-practices for your Panfactum version',
              status: 'stable'
            },
            { title: 'Guided Setup', description: 'Step-by-step guides for starting to work with IaC', status: 'stable' },
            {
              title: 'Policy Engine',
              description: 'Automatically validate your IaC with organizational policies',
              status: 'coming-soon'
            }
          ]}
        />
        <FeatureList
          title="Local Developer Environment"
          features={[
            {
              title: '100+ OSS tools',
              description: 'Includes the exact versions of all the tools known to work with the Panfactum stack components',
              status: 'stable'
            },
            {
              title: 'Customizable',
              description: 'Add your own tooling or override the Panfactum defaults',
              status: 'stable'
            },
            {
              title: 'Linux / MacOS / Windows Support',
              description: 'Windows support provided via WSLv2',
              status: 'stable'
            },
            {
              title: 'Native Install (No Containers)',
              description: 'Ditch the hassle of wrangling containers when working with tooling locally',
              status: 'stable'
            },
            {
              title: 'Automatic Updates',
              description: 'Automatically ensure that your tooling stays up-to-date with your Panfactum version',
              status: 'stable'
            }
          ]}
        />
        <FeatureList
          title="Production-Ready Kubernetes"
          features={[
            { title: 'Deployed on EKS', status: 'stable' },
            { title: 'Hardened OS', description: 'Provided by Bottlerocket', status: 'stable' },
            { title: 'Automatic Security Patches', status: 'stable' },
            { title: 'Cluster Autoscaling', description: 'Provided by Karpenter', status: 'stable' },
            { title: 'Ingress Networking with Automatic DNS', status: 'stable' },
            { title: 'Multi-AZ High-Availability', status: 'stable' },
            {
              title: 'Hashicorp Vault',
              description: 'Provides a Vault deployment for managing cluster secrets',
              status: 'stable'
            },
            {
              title: 'Descheduler',
              description: 'Automatically resolve cluster issues by re-scheduling problematic pods',
              status: 'stable'
            },
            {
              title: 'Metrics Visibility',
              description: 'Expose cluster metrics with the metrics-server and kube-state-metrics',
              status: 'stable'
            },
            {
              title: 'Point-in-time Backups',
              description: 'Restore the entire state of the cluster (including its data) at any time. Provided by Velero',
              status: 'stable'
            },
            { title: 'Intrusion Detection System', description: 'Provided by Falco', status: 'coming-soon' },
            {
              title: 'Policy Engine',
              description: 'To enforce certain Kubernetes configurations for your organization',
              status: 'coming-soon'
            },
            {
              title: 'Infrastructure Modules',
              description: 'Over a dozen infrastructure modules that can be used to deploy your own Kubernetes workloads in a production-hardened manner',
              status: 'alpha'
            }
          ]}
        />
        <FeatureList
          title="Authentication / Authorization"
          features={[
            { title: 'Integrated Identity Provider', description: 'Using self-hosted Authentik', status: 'stable' },
            {
              title: 'Multi-factor Authentication',
              description: 'MFA enforced with either TOTP or WebAuthn second factors',
              status: 'stable'
            },
            {
              title: 'Password Analysis',
              description: 'Automatically prevent users from using weak password or passwords found in leaked databases',
              status: 'stable'
            },
            {
              title: 'JIT Credential Provisioning',
              description: 'All stack components use just-in-time provisioned credentials, eliminating the risk associated with static, hard-coded secrets',
              status: 'stable'
            },
            {
              title: 'Infrastructure Single Sign-on',
              description: 'Includes AWS, Kubernetes, Vault, SSH, databases, and more',
              status: 'stable'
            },
            {
              title: 'SSH Bastion',
              description: 'Tunnel to private network resources using SSH with dynamic credentials',
              status: 'stable'
            },
            {
              title: 'Automatic Local Setup',
              description: 'Set up all local authentication with any infrastructure component in a single command',
              status: 'stable'
            },
            {
              title: 'Role-based Access Control',
              description: 'The stack deploys with standard roles for your users automatically provisioned and integrated into all infrastructure components',
              status: 'stable'
            },
            {
              title: 'Automatic IP Allowlists',
              description: 'Infrastructure credentials can never be used outside your infrastructure',
              status: 'stable'
            },
            {
              title: 'Standard Federated Auth Protocol Support',
              description: 'Includes SAML, OAuth2, OIDC, Active Directory, SCIM, and more',
              status: 'stable'
            },
            {
              title: 'Audit Logs',
              description: 'Authentication logs automatically shipped to the integrated observability platform',
              status: 'beta'
            },
            {
              title: 'Authenticating Web Proxy',
              description: 'Protect arbitrary private web resources with a login page',
              status: 'coming-soon'
            }
          ]}
        />
        <FeatureList
          title="Network Security"
          features={[
            { title: 'DNSSEC', status: 'stable' },
            { title: 'NAT Gateways', status: 'stable' },
            { title: 'mTLS Everywhere', description: 'Provided by the Linkerd2 service mesh', status: 'stable' },
            { title: 'Cloud Native Firewall', description: 'Provided by Cilium network policies', status: 'stable' },
            { title: 'Public Certificate Provisioning', description: 'Provided by cert-manager', status: 'stable' },
            { title: 'Automatic Certificate Rotation', description: 'Provided by cert-manager', status: 'stable' },
            { title: 'DDOS Mitigation', description: 'Provided by AWS and Cloudflare infrastructure', status: 'stable' },
            {
              title: 'Subdomain Delegation',
              description: 'Protect DNS zones by delegating their management to isolated environments',
              status: 'stable'
            },
            { title: 'Web Application Firewall', status: 'coming-soon' },
            {
              title: 'Audit Logging',
              description: 'Capture L3/4 flows via VPC flow logs and all L7 traffic via integrated proxies',
              status: 'stable'
            },
            {
              title: 'Bot Protection',
              description: 'The ability to protect public pages against bots',
              status: 'coming-soon'
            }
          ]}
        />
        <FeatureList
          title="Observability"
          features={[
            { title: 'Log Collection', description: 'Provided by Loki', status: 'coming-soon' },
            { title: 'Metric Collection', description: 'Provided by Prometheus', status: 'coming-soon' },
            { title: 'Tracing', description: 'Provided by OTEL', status: 'coming-soon' },
            { title: 'Real User Monitoring (RUM)', description: 'Provided by Grafana Faro', status: 'coming-soon' },
            { title: 'Dashboards & Query Engine', description: 'Provided by Grafana', status: 'coming-soon' },
            { title: 'Monitoring and Alerts', description: 'Provided by Alert Manager', status: 'coming-soon' },
            { title: 'On-call Management', description: 'Provided by Grafana OnCall OSS', status: 'coming-soon' },
            { title: '100+ Out-of-the-Box Monitors', status: 'coming-soon' }
          ]}
        />
        <FeatureList
          title="Immediate Integration"
          features={[
            {
              title: 'Live Developer Environments',
              description: 'Easily launch full, isolated, remote copies of the entire system',
              status: 'alpha'
            },
            {
              title: 'Production-like Infrastructure',
              description: 'Use the exact same IaC modules and systems used in production',
              status: 'alpha'
            },
            {
              title: 'Local Tooling',
              description: 'Continue to develop locally while automatically deploying to a live system',
              status: 'alpha'
            },
            { title: 'Hot Reloading', description: 'Automatically sync source code changes in seconds', status: 'alpha' },
            {
              title: 'Shared Build Cache',
              description: 'Share a build cache with your entire team to speed up downloads and compilation',
              status: 'alpha'
            }
          ]}
        />
        <FeatureList
          title="CI / CD"
          features={[
            {
              title: '10x Faster Container Builds',
              description: 'Uses Moby Buildkit on infinitely scaled infrastructure',
              status: 'alpha'
            },
            {
              title: 'Self-hosted Github Actions',
              description: 'Start running GHA directly on your infrastructure',
              status: 'beta'
            },
            { title: 'Argo Workflows', description: 'Use Argo for workflows too complex for GHA', status: 'coming-soon' },
            { title: 'Automated Dependency Updates', description: 'Provided by Renovate', status: 'coming-soon' },
            {
              title: 'Out-of-the-Box Pipelines',
              description: 'We provide dozens of out-of-the-box pipelines for deploying your workloads and IaC to the Panfactum stack',
              status: 'coming-soon'
            },
            {
              title: 'Traffic Shifting',
              description: 'Slowly shift traffic to new deployments while validating new behavior',
              status: 'coming-soon'
            },
            {
              title: 'Automated Rollbacks',
              description: 'Automatically rollback deployments that generate unexpected errors',
              status: 'coming-soon'
            }
          ]}
        />
        <FeatureList
          title="Workflow Engine"
          features={[
            { title: 'Build Arbitrary Pipelines', description: 'Using Argo Workflows', status: 'coming-soon' },
            { title: 'Trigger from Arbitrary Events', description: 'Using Argo Events', status: 'coming-soon' },
            { title: 'Web UI', status: 'coming-soon' },
            { title: 'Durable Execution', description: 'Provided by Temporal', status: 'coming-soon' }
          ]}
        />
        <FeatureList
          title="Integrated Databases"
          features={[
            {
              title: 'PostgreSQL',
              description: 'Includes pgbouncer and point-in-time WAL backups. Provided by CloudNativePG',
              status: 'stable'
            },
            { title: 'Redis', description: 'Includes both persistent and in-memory cache modes', status: 'stable' },
            { title: 'Kafka', description: 'Use Kafka for events and queues', status: 'coming-soon' },
            { title: 'Typesense', description: 'For realtime text search', status: 'coming-soon' },
            { title: 'ClickHouse', description: 'For all your data warehousing needs', status: 'coming-soon' }
          ]}
        />
        <FeatureList
          title="Cost Management"
          features={[
            {
              title: 'Self-hosted Infrastructure',
              description: 'All stack components run on your own infrastructure with no managed-service markups',
              status: 'stable'
            },
            {
              title: 'Automatic Resource Adjustments',
              description: 'Resource allocations will automatically adjust to actual workloads for all deployed infrastructure',
              status: 'stable'
            },
            {
              title: 'Spot Instances',
              description: 'Receive up to 90% off your workloads when using the integrated spot instancing scheduling capabilities',
              status: 'stable'
            },
            {
              title: 'Locality Aware Traffic Routing',
              description: 'Automatically reduce inter-zone traffic charges',
              status: 'stable'
            },
            {
              title: 'Optimized AWS Network Configuration',
              description: "We've heavily optimized the default AWS configurations to provide optimal cost savings",
              status: 'stable'
            },
            { title: 'Scale-to-zero', description: 'Scale development resources to 0 when not in use', status: 'alpha' },
            {
              title: 'CDN',
              description: 'Automatically cache resources to reduce network costs and improve performance',
              status: 'coming-soon'
            },
            {
              title: 'Budget Alarms',
              description: 'Get notified when infrastructure spends exceeds certain levels',
              status: 'coming-soon'
            }
          ]}
        />
      </div>
      <div className="inline-grid grid-cols-[min-content_auto] auto-cols-auto w-full max-w-3xl mx-auto pt-8 gap-y-8">
        <StatusChip status={'stable'}/>
        <p className="text-lg font-medium px-4">
          <Balancer>Ready for production use</Balancer>
        </p>
        <StatusChip status={'beta'}/>
        <p className="text-lg font-medium px-4">
          <Balancer>Safe to use, but API might change as public feedback collected</Balancer>
        </p>
        <StatusChip status={'alpha'}/>
        <p className="text-lg font-medium px-4">
          <Balancer>Internal use and private testing only</Balancer>
        </p>
        <StatusChip status={'coming-soon'}/>
        <p className="text-lg font-medium px-4">
          <Balancer>On the development roadmap</Balancer>
        </p>
      </div>
    </div>
  )
}
