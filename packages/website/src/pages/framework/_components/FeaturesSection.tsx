// Features section component for the framework page
// Handles feature grid display, filtering, and selection
import { clsx } from "clsx";
import type { default as Masonry } from "masonry-layout";
import { HiSolidCog } from "solid-icons/hi";
import {
  type Component,
  createSignal,
  createEffect,
  onCleanup,
  For,
  Show,
  onMount,
  createMemo,
} from "solid-js";
import { Dynamic } from "solid-js/web";

// Import all feature components
import { APIServers } from "./features/APIServers";
import { AgenticAI } from "./features/AgenticAI";
import { AutoInstrumentation } from "./features/AutoInstrumentation";
import { AutomatedClusterBackups } from "./features/AutomatedClusterBackups";
import { AutomatedCredentialRotation } from "./features/AutomatedCredentialRotation";
import { AutomaticFailover } from "./features/AutomaticFailover";
import { AutomaticRetries } from "./features/AutomaticRetries";
import { BackgroundWorkers } from "./features/BackgroundWorkers";
import { BareMetal } from "./features/BareMetal";
import { Binpacking } from "./features/Binpacking";
import { CDNIntegrations } from "./features/CDNIntegrations";
import { CISBenchmarking } from "./features/CISBenchmarking";
import { CanaryDeployments } from "./features/CanaryDeployments";
import { ChaosEngineering } from "./features/ChaosEngineering";
import { ChatOps } from "./features/ChatOps";
import { CloudNativeFirewall } from "./features/CloudNativeFirewall";
import { ClusterAutoscaling } from "./features/ClusterAutoscaling";
import { ConfigurableSLATargets } from "./features/ConfigurableSLATargets";
import { ContinuousDBBackups } from "./features/ContinuousDBBackups";
import { ContinuousPreviews } from "./features/ContinuousPreviews";
import { Cron } from "./features/Cron";
import { DOSPrevention } from "./features/DOSPrevention";
import { Databases } from "./features/Databases";
import { DeletionPrevention } from "./features/DeletionPrevention";
import { DevShell } from "./features/DevShell";
import { DeveloperEnvironments } from "./features/DeveloperEnvironments";
import { DeveloperPortal } from "./features/DeveloperPortal";
import { DisruptionWindows } from "./features/DisruptionWindows";
import { EWMALoadBalancing } from "./features/EWMALoadBalancing";
import { EncryptionAtRest } from "./features/EncryptionAtRest";
import { EncryptionInTransit } from "./features/EncryptionInTransit";
import { EnterprisePasswordManagement } from "./features/EnterprisePasswordManagement";
import { FeatureFlagging } from "./features/FeatureFlagging";
import { FederatedAuthIntegrations } from "./features/FederatedAuthIntegrations";
import { GitOps } from "./features/GitOps";
import { HTTPSecurityHeaders } from "./features/HTTPSecurityHeaders";
import { IaCSubmodules } from "./features/IaCSubmodules";
import { IdentityProvider } from "./features/IdentityProvider";
import { ImageBuildAccelerator } from "./features/ImageBuildAccelerator";
import { ImageScanning } from "./features/ImageScanning";
import { ImmutableAuditSinks } from "./features/ImmutableAuditSinks";
import { InfrastructureAsCode } from "./features/InfrastructureAsCode";
import { InfrastructureDeployments } from "./features/InfrastructureDeployments";
import { IntegratedDeveloperAI } from "./features/IntegratedDeveloperAI";
import { LocalImageCache } from "./features/LocalImageCache";
import { LocalityAwareNetworking } from "./features/LocalityAwareNetworking";
import { LogsMetricsTraces } from "./features/LogsMetricsTraces";
import { MessageQueues } from "./features/MessageQueues";
import { MultiPlatformImages } from "./features/MultiPlatformImages";
import { NetworkMesh } from "./features/NetworkMesh";
import { OnCallManagement } from "./features/OnCallManagement";
import { OptimizedNAT } from "./features/OptimizedNAT";
import { PolicyEngine } from "./features/PolicyEngine";
import { PrebuiltDashboardsAlerts } from "./features/PrebuiltDashboardsAlerts";
import { RBAC } from "./features/RBAC";
import { SBOM } from "./features/SBOM";
import { SIEM } from "./features/SIEM";
import { SOC2Ready } from "./features/SOC2Ready";
import { SSHBastions } from "./features/SSHBastions";
import { SSOEverywhere } from "./features/SSOEverywhere";
import { ScaleToZero } from "./features/ScaleToZero";
import { SelfHostedRunners } from "./features/SelfHostedRunners";
import { Serverless } from "./features/Serverless";
import { SessionPinning } from "./features/SessionPinning";
import { SpotInstanceIntegrations } from "./features/SpotInstanceIntegrations";
import { StartupOptimizations } from "./features/StartupOptimizations";
import { SyntheticTesting } from "./features/SyntheticTesting";
import { WAFIntegration } from "./features/WAFIntegration";
import { WorkflowEngines } from "./features/WorkflowEngines";
import { WorkloadAutoscaling } from "./features/WorkloadAutoscaling";
import { WorkloadCostTracking } from "./features/WorkloadCostTracking";
import type { Feature, FeatureCategory, Stage } from "./types";

// Randomly assign stages to features for now
const randomStage = (): Stage => {
  const stages: Stage[] = ["Stable", "Beta", "Alpha", "Roadmap"];
  return stages[Math.floor(Math.random() * stages.length)];
};

// Feature configuration
const FEATURES: FeatureCategory[] = [
  {
    name: "Platform Engineering",
    features: [
      {
        id: "infrastructure-as-code",
        name: "Infrastructure as Code",
        component: InfrastructureAsCode,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "infrastructure-deployments",
        name: "Infrastructure Deployments",
        component: InfrastructureDeployments,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "gitops",
        name: "GitOps",
        component: GitOps,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "policy-engine",
        name: "Policy Engine",
        component: PolicyEngine,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "cluster-autoscaling",
        name: "Cluster Autoscaling",
        component: ClusterAutoscaling,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "workload-autoscaling",
        name: "Workload Autoscaling",
        component: WorkloadAutoscaling,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "scale-to-zero",
        name: "Scale-to-zero",
        component: ScaleToZero,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "binpacking",
        name: "Binpacking",
        component: Binpacking,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "disruption-windows",
        name: "Disruption Windows",
        component: DisruptionWindows,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "deletion-prevention",
        name: "Deletion Prevention",
        component: DeletionPrevention,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "configurable-sla-targets",
        name: "Configurable SLA Targets",
        component: ConfigurableSLATargets,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Application Patterns",
    features: [
      {
        id: "api-servers",
        name: "API Servers",
        component: APIServers,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "background-workers",
        name: "Background Workers",
        component: BackgroundWorkers,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "cron",
        name: "Cron",
        component: Cron,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "workflow-engines",
        name: "Workflow Engines",
        component: WorkflowEngines,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "message-queues",
        name: "Message Queues",
        component: MessageQueues,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "automatic-retries",
        name: "Automatic Retries",
        component: AutomaticRetries,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "automatic-failover",
        name: "Automatic Failover",
        component: AutomaticFailover,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "session-pinning",
        name: "Session Pinning",
        component: SessionPinning,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "ewma-load-balancing",
        name: "EWMA Load Balancing",
        component: EWMALoadBalancing,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "locality-aware-networking",
        name: "Locality-aware Networking",
        component: LocalityAwareNetworking,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "feature-flagging",
        name: "Feature Flagging",
        component: FeatureFlagging,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Deployment Patterns",
    features: [
      {
        id: "canary-deployments",
        name: "Canary Deployments",
        component: CanaryDeployments,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "multi-platform-images",
        name: "Multi-platform Images",
        component: MultiPlatformImages,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "image-build-accelerator",
        name: "Image Build Accelerator",
        component: ImageBuildAccelerator,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "local-image-cache",
        name: "Local Image Cache",
        component: LocalImageCache,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "startup-optimizations",
        name: "Startup Optimizations",
        component: StartupOptimizations,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "self-hosted-runners",
        name: "Self-hosted Runners",
        component: SelfHostedRunners,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "automated-cluster-backups",
        name: "Automated Cluster Backups",
        component: AutomatedClusterBackups,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "continuous-db-backups",
        name: "Continuous DB Backups",
        component: ContinuousDBBackups,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "spot-instance-integrations",
        name: "Spot Instance Integrations",
        component: SpotInstanceIntegrations,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "enterprise-password-management",
        name: "Enterprise Password Management",
        component: EnterprisePasswordManagement,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "cdn-integrations",
        name: "CDN Integrations",
        component: CDNIntegrations,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "optimized-nat",
        name: "Optimized NAT",
        component: OptimizedNAT,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "bare-metal",
        name: "Bare Metal",
        component: BareMetal,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Supply Chain Security",
    features: [
      {
        id: "image-scanning",
        name: "Image Scanning",
        component: ImageScanning,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "sbom",
        name: "SBOM",
        component: SBOM,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "cis-benchmarking",
        name: "CIS Benchmarking",
        component: CISBenchmarking,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "soc2-ready",
        name: "SOC2 Ready",
        component: SOC2Ready,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "chaos-engineering",
        name: "Chaos Engineering",
        component: ChaosEngineering,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Observability",
    features: [
      {
        id: "logs-metrics-traces",
        name: "Logs, Metrics, and Traces",
        component: LogsMetricsTraces,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "prebuilt-dashboards-alerts",
        name: "Prebuilt Dashboards and Alerts",
        component: PrebuiltDashboardsAlerts,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "workload-cost-tracking",
        name: "Workload Cost Tracking",
        component: WorkloadCostTracking,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "immutable-audit-sinks",
        name: "Immutable Audit Sinks",
        component: ImmutableAuditSinks,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "chatops",
        name: "ChatOps",
        component: ChatOps,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "auto-instrumentation",
        name: "Auto-instrumentation",
        component: AutoInstrumentation,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "synthetic-testing",
        name: "Synthetic Testing",
        component: SyntheticTesting,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "on-call-management",
        name: "On-call Management",
        component: OnCallManagement,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Runtime Security",
    features: [
      {
        id: "identity-provider",
        name: "Identity Provider (IdP)",
        component: IdentityProvider,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "federated-auth",
        name: "Federated Auth Integrations",
        component: FederatedAuthIntegrations,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "rbac",
        name: "RBAC",
        component: RBAC,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "encryption-in-transit",
        name: "Encryption-in-transit",
        component: EncryptionInTransit,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "encryption-at-rest",
        name: "Encryption-at-rest",
        component: EncryptionAtRest,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "cloud-native-firewall",
        name: "Cloud Native Firewall",
        component: CloudNativeFirewall,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "http-security-headers",
        name: "HTTP Security Headers",
        component: HTTPSecurityHeaders,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "dos-prevention",
        name: "DOS Prevention",
        component: DOSPrevention,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "waf-integration",
        name: "WAF Integration",
        component: WAFIntegration,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "automated-credential-rotation",
        name: "Automated Credential Rotation",
        component: AutomatedCredentialRotation,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "siem",
        name: "SIEM",
        component: SIEM,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Developer Experience",
    features: [
      {
        id: "devshell",
        name: "DevShell",
        component: DevShell,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "sso-everywhere",
        name: "SSO Everywhere",
        component: SSOEverywhere,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "developer-portal",
        name: "Developer Portal",
        component: DeveloperPortal,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "developer-environments",
        name: "Developer Environments",
        component: DeveloperEnvironments,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "network-mesh",
        name: "Network Mesh",
        component: NetworkMesh,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "ssh-bastions",
        name: "SSH Bastions",
        component: SSHBastions,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "continuous-previews",
        name: "Continuous Previews",
        component: ContinuousPreviews,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "iac-submodules",
        name: "100+ IaC Submodules",
        component: IaCSubmodules,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "integrated-developer-ai",
        name: "Integrated Developer AI",
        component: IntegratedDeveloperAI,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
  {
    name: "Infrastructure Patterns",
    features: [
      {
        id: "databases",
        name: "Databases",
        component: Databases,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "serverless",
        name: "Serverless",
        component: Serverless,
        stage: randomStage(),
        icon: HiSolidCog,
      },
      {
        id: "agentic-ai",
        name: "Agentic AI",
        component: AgenticAI,
        stage: randomStage(),
        icon: HiSolidCog,
      },
    ],
  },
];

const StageFilter: Component<{
  stage: Stage | "All features";
  isActive: boolean;
  onClick: () => void;
}> = (props) => {
  return (
    <button
      onClick={() => {
        props.onClick();
      }}
      class={clsx(
        `
          flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          transition-colors
        `,
        props.isActive
          ? `bg-brand-800 text-white`
          : `
            bg-tertiary text-secondary
            hover:text-primary
          `,
      )}
    >
      {props.stage !== "All features" && (
        <div
          class={clsx(
            "h-2 w-2 rounded-full",
            props.stage === "Stable" && "bg-blue-500",
            props.stage === "Beta" && "bg-yellow-500",
            props.stage === "Alpha" && "bg-orange-500",
            props.stage === "Roadmap" && "bg-gray-500",
          )}
        />
      )}
      {props.stage}
    </button>
  );
};

const FeatureButton: Component<{
  feature: Feature;
  isActive: boolean;
  isProgressing: boolean;
  isFading: boolean;
  onClick: () => void;
  progressPercentage: number;
}> = (props) => {
  return (
    <button
      onClick={() => {
        props.onClick();
      }}
      class={clsx(
        `
          group relative flex w-full items-center gap-3 overflow-hidden
          rounded-lg border px-2 py-2 text-left transition-all
        `,
        props.isActive
          ? `border-transparent bg-brand-400/20 text-primary`
          : `
            border-transparent text-secondary
            hover:bg-gray-dark-mode-800/50 hover:text-primary
          `,
      )}
      aria-label={`Select ${props.feature.name} feature`}
    >
      <Show when={props.isProgressing}>
        <div
          class="absolute inset-0 origin-left bg-brand-400/20"
          style={{
            transform: `scaleX(${props.progressPercentage / 100})`,
            opacity: props.isFading ? 0 : 1,
            transition: props.isFading ? "opacity 0.3s ease-out" : "none",
          }}
        />
      </Show>
      <div class="relative flex items-center gap-3">
        <props.feature.icon class="h-5 w-5 flex-shrink-0" />
        <span class="text-sm font-medium">{props.feature.name}</span>
      </div>
    </button>
  );
};

export const FeaturesSection: Component = () => {
  const [selectedFeature, setSelectedFeature] = createSignal<Feature | null>(
    null,
  );
  const [activeFilter, setActiveFilter] = createSignal<Stage | "All features">(
    "All features",
  );
  const [isAutoPaused, setIsAutoPaused] = createSignal(false);
  const [progressingFeature, setProgressingFeature] = createSignal<
    string | null
  >(null);
  const [progressPercentage, setProgressPercentage] = createSignal(0);

  // Get all features in a flat array
  const allFeatures = () => FEATURES.flatMap((category) => category.features);

  // Get only visible features based on current filter
  const visibleFeatures = () =>
    allFeatures().filter((feature) => isFeatureVisible(feature));

  // Get filtered features for mobile dropdown (removes from DOM)
  const filteredFeatures = () => {
    const filter = activeFilter();
    if (filter === "All features") return FEATURES;

    return FEATURES.map((category) => ({
      ...category,
      features: category.features.filter((feature) => feature.stage === filter),
    })).filter((category) => category.features.length > 0);
  };

  // Check if a feature should be visible (for CSS hiding)
  const isFeatureVisible = (feature: Feature) => {
    const filter = activeFilter();
    return filter === "All features" || feature.stage === filter;
  };

  // Check if a category should be visible (has at least one visible feature)
  const isCategoryVisible = (category: FeatureCategory) => {
    return category.features.some((feature) => isFeatureVisible(feature));
  };

  // Track completion to trigger next progression
  const [progressionComplete, setProgressionComplete] = createSignal(0);
  const [isFading, setIsFading] = createSignal(false);
  const [isFirstProgression, setIsFirstProgression] = createSignal(true);

  // Auto-progression logic
  createEffect(() => {
    if (isAutoPaused()) return;

    const features = visibleFeatures();
    if (features.length === 0) return;

    // Re-run when progression completes
    progressionComplete();

    let animationFrame: ReturnType<typeof requestAnimationFrame>;
    let startTime: number | null = null;
    const fillDuration = 2000; // 2 seconds to fill
    const pauseDuration = 200; // 200ms pause at full
    const fadeDuration = 300; // 300ms to fade out
    let pauseTimeoutId: ReturnType<typeof setTimeout>;
    let fadeTimeoutId: ReturnType<typeof setTimeout>;
    let nextTimeoutId: ReturnType<typeof setTimeout>;

    // Select a random feature (or use currently selected if this is the first run and it's visible)
    const currentSelected = selectedFeature();
    const featureToProgress =
      isFirstProgression() &&
      currentSelected &&
      features.find((f) => f.id === currentSelected.id)
        ? currentSelected
        : features[Math.floor(Math.random() * features.length)];
    setProgressingFeature(featureToProgress.id);
    setSelectedFeature(featureToProgress); // Show content immediately when fill starts
    setIsFirstProgression(false); // Mark that we've done the first progression
    setProgressPercentage(0);
    setIsFading(false);

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / fillDuration, 1);

      setProgressPercentage(progress * 100);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Fill is complete, pause at 100%
        pauseTimeoutId = setTimeout(() => {
          // Start fading
          setIsFading(true);

          fadeTimeoutId = setTimeout(() => {
            // After fade, reset and trigger next
            setProgressingFeature(null);
            setProgressPercentage(0);
            setIsFading(false);

            nextTimeoutId = setTimeout(() => {
              setProgressionComplete((c) => c + 1);
            }, 50);
          }, fadeDuration);
        }, pauseDuration);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    onCleanup(() => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (animationFrame) cancelAnimationFrame(animationFrame);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (nextTimeoutId) clearTimeout(nextTimeoutId);
      setProgressingFeature(null);
      setProgressPercentage(0);
      setIsFading(false);
    });
  });

  // Set initial feature
  onMount(() => {
    const features = visibleFeatures();
    if (features.length > 0) {
      setSelectedFeature(features[0]);
    }
  });

  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setIsAutoPaused(true);
    // Stop any current progression
    setProgressingFeature(null);
    setProgressPercentage(0);
    setIsFading(false);
  };

  const handleFilterClick = (filter: Stage | "All features") => {
    setActiveFilter(filter);

    // Use a temporary filter calculation since visibleFeatures() won't be updated yet
    const filteredList = allFeatures().filter(
      (f) => filter === "All features" || f.stage === filter,
    );

    const currentSelected = selectedFeature();
    if (
      currentSelected &&
      !filteredList.find((f) => f.id === currentSelected.id)
    ) {
      setSelectedFeature(filteredList[0] || null);
    }
  };

  return (
    <div class="mt-16">
      {/* Stage Filters - Hidden on mobile */}
      <div
        class={`
          mb-8 hidden items-center gap-2 overflow-x-auto pb-2
          md:flex
        `}
      >
        <StageFilter
          stage="All features"
          isActive={activeFilter() === "All features"}
          onClick={() => {
            handleFilterClick("All features");
          }}
        />
        <StageFilter
          stage="Stable"
          isActive={activeFilter() === "Stable"}
          onClick={() => {
            handleFilterClick("Stable");
          }}
        />
        <StageFilter
          stage="Beta"
          isActive={activeFilter() === "Beta"}
          onClick={() => {
            handleFilterClick("Beta");
          }}
        />
        <StageFilter
          stage="Alpha"
          isActive={activeFilter() === "Alpha"}
          onClick={() => {
            handleFilterClick("Alpha");
          }}
        />
        <StageFilter
          stage="Roadmap"
          isActive={activeFilter() === "Roadmap"}
          onClick={() => {
            handleFilterClick("Roadmap");
          }}
        />
      </div>

      {/* Mobile Layout - Dropdown and Panel only */}
      <div class="md:hidden">
        <Show
          when={filteredFeatures().length > 0}
          fallback={
            <div>
              <p class="py-8 text-center text-secondary">
                No features available for the selected stage.
              </p>
            </div>
          }
        >
          <div>
            {/* Feature Dropdown Selector */}
            <div class="mb-4">
              <label>
                <span class="sr-only">Select a feature</span>
                <select
                  class={`
                    w-full rounded-lg border border-gray-dark-mode-700
                    bg-secondary px-4 py-3 text-primary transition-colors
                    hover:border-gray-dark-mode-600
                    focus:border-brand-400 focus:ring-1 focus:ring-brand-400
                    focus:outline-none
                  `}
                  onChange={(e) => {
                    const selectedId = e.currentTarget.value;
                    const feature = allFeatures().find(
                      (f) => f.id === selectedId,
                    );
                    if (feature) {
                      handleFeatureClick(feature);
                    }
                  }}
                  value={selectedFeature()?.id || ""}
                >
                  <option value="" disabled>
                    Select a feature...
                  </option>
                  <For each={filteredFeatures()}>
                    {(category) => (
                      <optgroup label={category.name}>
                        <For each={category.features}>
                          {(feature) => (
                            <option value={feature.id}>
                              {feature.name} ({feature.stage})
                            </option>
                          )}
                        </For>
                      </optgroup>
                    )}
                  </For>
                </select>
              </label>
            </div>

            {/* Content Panel */}
            <div
              class={`h-[600px] overflow-y-auto rounded-xl bg-secondary p-8`}
              onMouseEnter={() => setIsAutoPaused(true)}
              role="region"
              aria-label="Feature details panel"
            >
              <Show
                when={selectedFeature()}
                fallback={
                  <div class="flex h-full items-center justify-center">
                    <p class="text-secondary">
                      Select a feature from the dropdown above
                    </p>
                  </div>
                }
              >
                {(feature) => <Dynamic component={feature().component} />}
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Desktop Masonry Layout */}
      <div
        class={`
          hidden
          md:block
        `}
      >
        <Show
          when={filteredFeatures().length > 0}
          fallback={
            <div>
              <p class="py-8 text-center text-secondary">
                No features available for the selected stage.
              </p>
            </div>
          }
        >
          {(() => {
            let gridRef: HTMLDivElement | undefined;

            let masonryInstance: Masonry | undefined;

            // Use all features for masonry (don't remove from DOM)
            const categoriesWithFeatures = createMemo(() => FEATURES);

            onMount(() => {
              void (async () => {
                if (typeof window !== "undefined" && gridRef) {
                  const Masonry = (await import("masonry-layout")).default;
                  masonryInstance = new Masonry(gridRef, {
                    itemSelector: ".masonry-item",
                    columnWidth: ".masonry-sizer",
                    percentPosition: true,
                    gutter: 32,
                  });

                  // Force initial layout after a small delay to ensure DOM is ready
                  setTimeout(() => {
                    masonryInstance?.layout?.();
                  }, 100);
                }
              })();
            });

            createEffect(() => {
              // Trigger layout when filter changes
              activeFilter();
              if (typeof window !== "undefined" && masonryInstance) {
                requestAnimationFrame(() => {
                  masonryInstance?.layout?.();
                });
              }
            });

            onCleanup(() => {
              masonryInstance?.destroy?.();
            });

            return (
              <div ref={gridRef} class="relative">
                {/* Sizer element for masonry grid */}
                <div
                  class={`
                    masonry-sizer w-full
                    md:w-[calc(25%-24px)]
                    lg:w-[calc(20%-25.6px)]
                  `}
                />

                {/* Render all categories and panel in order for masonry */}
                <For each={categoriesWithFeatures()}>
                  {(category, index) => (
                    <>
                      {/* Insert panel after 2 categories on medium, after 3 on large */}
                      <Show when={index() === 2}>
                        <div
                          class={`
                            hidden
                            md:block
                            lg:hidden
                          `}
                        >
                          <div
                            class={`
                              masonry-item mb-8 w-full
                              md:w-[calc(50%-16px)]
                            `}
                          >
                            <div
                              class={`
                                h-[600px] overflow-y-auto rounded-xl
                                bg-secondary p-8
                              `}
                              onMouseEnter={() => setIsAutoPaused(true)}
                              role="region"
                              aria-label="Feature details panel"
                            >
                              <Show
                                when={selectedFeature()}
                                fallback={
                                  <div
                                    class={`
                                      flex h-full items-center justify-center
                                    `}
                                  >
                                    <p class="text-secondary">
                                      Select a feature to view details
                                    </p>
                                  </div>
                                }
                              >
                                {(feature) => (
                                  <Dynamic component={feature().component} />
                                )}
                              </Show>
                            </div>
                          </div>
                        </div>
                      </Show>
                      <Show when={index() === 3}>
                        <div
                          class={`
                            hidden
                            lg:block
                          `}
                        >
                          <div
                            class={`
                              masonry-item mb-8 w-full
                              lg:w-[calc(40%-19.2px)]
                            `}
                          >
                            <div
                              class={`
                                h-[600px] overflow-y-auto rounded-xl
                                bg-secondary p-8
                              `}
                              onMouseEnter={() => setIsAutoPaused(true)}
                              role="region"
                              aria-label="Feature details panel"
                            >
                              <Show
                                when={selectedFeature()}
                                fallback={
                                  <div
                                    class={`
                                      flex h-full items-center justify-center
                                    `}
                                  >
                                    <p class="text-secondary">
                                      Select a feature to view details
                                    </p>
                                  </div>
                                }
                              >
                                {(feature) => (
                                  <Dynamic component={feature().component} />
                                )}
                              </Show>
                            </div>
                          </div>
                        </div>
                      </Show>
                      <div
                        class={clsx(
                          `
                            masonry-item mb-8 w-full transition-opacity
                            duration-300
                            md:w-[calc(25%-24px)]
                            lg:w-[calc(20%-25.6px)]
                          `,
                          !isCategoryVisible(category) &&
                            `pointer-events-none opacity-0`,
                        )}
                      >
                        <div class="group/category relative">
                          <h3
                            class={`
                              mb-3 text-sm font-semibold tracking-wider
                              text-secondary uppercase transition-colors
                              group-hover/category:text-primary
                            `}
                          >
                            {category.name}
                          </h3>
                          <div class="relative">
                            {/* Vertical line that extends from top of first feature to bottom */}
                            <div
                              class={`
                                absolute top-0 bottom-0 left-0 w-px
                                bg-gray-dark-mode-700 transition-colors
                                group-hover/category:bg-gray-dark-mode-600
                              `}
                              aria-hidden="true"
                            />
                            <div class="ml-4 space-y-2">
                              <For each={category.features}>
                                {(feature) => (
                                  <div
                                    class={clsx(
                                      "relative transition-opacity duration-300",
                                      !isFeatureVisible(feature) &&
                                        `pointer-events-none opacity-0`,
                                    )}
                                  >
                                    {/* Stage dot positioned on the vertical line */}
                                    <div
                                      class={clsx(
                                        `
                                          absolute top-1/2 -left-4 z-10 h-2.5
                                          w-2.5 -translate-x-1/2
                                          -translate-y-1/2 rounded-full
                                        `,
                                        feature.stage === "Stable" &&
                                          `bg-blue-500`,
                                        feature.stage === "Beta" &&
                                          `bg-yellow-500`,
                                        feature.stage === "Alpha" &&
                                          `bg-orange-500`,
                                        feature.stage === "Roadmap" &&
                                          `bg-gray-500`,
                                      )}
                                      aria-label={feature.stage}
                                    />
                                    <FeatureButton
                                      feature={feature}
                                      isActive={
                                        selectedFeature()?.id === feature.id
                                      }
                                      isProgressing={
                                        progressingFeature() === feature.id
                                      }
                                      isFading={isFading()}
                                      progressPercentage={progressPercentage()}
                                      onClick={() => {
                                        handleFeatureClick(feature);
                                      }}
                                    />
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </For>
              </div>
            );
          })()}
        </Show>
      </div>
    </div>
  );
};
