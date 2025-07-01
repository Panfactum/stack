// Compliance gaps visualization component showing security and regulatory issues
// Displays compliance checklist with failing requirements and risk indicators

import { clsx } from "clsx";
import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  For,
  type Component,
} from "solid-js";

import { FlippableCard } from "./FlippableCard";

// ================================================================================================
// COMPONENT PROPS INTERFACE
// ================================================================================================

interface IComplianceGapsProps {
  isVisible?: boolean;
}

// ================================================================================================
// DATA CONFIGURATION CONSTANTS
// ================================================================================================

// Compliance requirements with their current status
const COMPLIANCE_REQUIREMENTS = [
  {
    category: "SOC 2",
    requirement: "Access Controls",
    status: "failing",
    severity: "high",
  },
  {
    category: "SOC 2",
    requirement: "Data Encryption",
    status: "passing",
    severity: "high",
  },
  {
    category: "SOC 2",
    requirement: "Audit Logging",
    status: "failing",
    severity: "medium",
  },
  {
    category: "GDPR",
    requirement: "Data Retention",
    status: "failing",
    severity: "high",
  },
  {
    category: "GDPR",
    requirement: "Right to Erasure",
    status: "unknown",
    severity: "medium",
  },
  {
    category: "HIPAA",
    requirement: "PHI Protection",
    status: "failing",
    severity: "critical",
  },
  {
    category: "PCI DSS",
    requirement: "Network Segmentation",
    status: "failing",
    severity: "high",
  },
  {
    category: "ISO 27001",
    requirement: "Risk Assessment",
    status: "unknown",
    severity: "medium",
  },
];

const RISK_METRICS = [
  { label: "Critical Violations", count: 2, trend: "increasing" },
  { label: "High Risk Items", count: 7, trend: "stable" },
  { label: "Open Findings", count: 23, trend: "increasing" },
  { label: "Days to Audit", count: 45, trend: "decreasing" },
];

const URGENT_ACTIONS = [
  "Implement multi-factor authentication",
  "Establish data classification policy",
  "Deploy DLP solutions",
  "Complete vulnerability assessments",
];

const ANIMATION_DURATION = 2800;

export const ComplianceGaps: Component<IComplianceGapsProps> = (props) => {
  const [animationProgress, setAnimationProgress] = createSignal(0);
  const [risksVisible, setRisksVisible] = createSignal(false);
  const [actionsVisible, setActionsVisible] = createSignal(false);

  let animationRef: number;
  let startTime: number;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "failing":
        return "text-red-400 bg-red-900/20 border-red-500/50";
      case "passing":
        return "text-green-400 bg-green-900/20 border-green-500/50";
      case "unknown":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-500/50";
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-500/50";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "failing":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="text-red-400"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
      case "passing":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="text-green-400"
          >
            <path
              d="M20 6L9 17L4 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
      case "unknown":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="text-yellow-400"
          >
            <path
              d="M8 12h8M12 8v8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            class="text-red-400"
          >
            <path
              d="M7 14L12 9L17 14"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
      case "decreasing":
        return (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            class="text-green-400"
          >
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
      default:
        return (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            class="text-gray-400"
          >
            <path
              d="M8 12H16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        );
    }
  };

  const resetAnimation = () => {
    if (animationRef) {
      cancelAnimationFrame(animationRef);
    }
    setAnimationProgress(0);
    setRisksVisible(false);
    setActionsVisible(false);
  };

  const startAnimation = () => {
    startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      setAnimationProgress(progress);

      if (progress > 0.4) {
        setRisksVisible(true);
      }

      if (progress > 0.7) {
        setActionsVisible(true);
      }

      if (progress < 1) {
        animationRef = requestAnimationFrame(animate);
      }
    };

    animationRef = requestAnimationFrame(animate);
  };

  // Restart animation when component becomes visible
  createEffect(() => {
    if (props.isVisible) {
      resetAnimation();
      setTimeout(() => {
        startAnimation();
      }, 500);
    } else {
      resetAnimation();
    }
  });

  onMount(() => {
    // Start animation immediately if visible on mount
    if (props.isVisible !== false) {
      setTimeout(() => {
        startAnimation();
      }, 500);
    }
  });

  onCleanup(() => {
    if (animationRef) {
      cancelAnimationFrame(animationRef);
    }
  });

  const frontContent = (
    <div
      class="relative flex h-full w-full items-center justify-center"
      role="img"
      aria-label="Compliance dashboard showing gaps and violations across multiple security and regulatory frameworks"
      style={{
        background: "#0a0e1a",
        "font-family":
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      {/* Screen reader content */}
      <div class="sr-only">
        <h3>Compliance Gaps Analysis</h3>
        <p>Compliance requirements status:</p>
        <ul>
          <For each={COMPLIANCE_REQUIREMENTS}>
            {(req) => (
              <li>
                {req.category} - {req.requirement}: {req.status} ({req.severity}{" "}
                severity)
              </li>
            )}
          </For>
        </ul>
        <p>Risk metrics:</p>
        <ul>
          <For each={RISK_METRICS}>
            {(metric) => (
              <li>
                {metric.label}: {metric.count} ({metric.trend})
              </li>
            )}
          </For>
        </ul>
        <p>Urgent actions: {URGENT_ACTIONS.join(", ")}</p>
      </div>

      <div
        class="relative flex h-full w-full max-w-2xl flex-col p-6"
        aria-hidden="true"
      >
        {/* Dashboard header */}
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-bold text-white">Compliance Status</h3>
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span class="text-sm text-red-400">
              {
                COMPLIANCE_REQUIREMENTS.filter((r) => r.status === "failing")
                  .length
              }{" "}
              Violations
            </span>
          </div>
        </div>

        {/* Compliance requirements list */}
        <div class="mb-4 flex-1 space-y-2 overflow-y-auto">
          <For each={COMPLIANCE_REQUIREMENTS}>
            {(req, index) => (
              <div
                class={clsx(
                  `
                    flex items-center justify-between rounded-lg border p-3
                    transition-all duration-500
                  `,
                  getStatusColor(req.status),
                )}
                style={{
                  opacity: animationProgress() > index() * 0.05 ? 1 : 0.3,
                  transform: `translateX(${animationProgress() > index() * 0.05 ? 0 : -20}px)`,
                }}
              >
                <div class="flex items-center gap-3">
                  {getStatusIcon(req.status)}
                  <div>
                    <div class="text-sm font-medium">{req.requirement}</div>
                    <div class="text-xs text-gray-400">{req.category}</div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <div
                    class={clsx(
                      "h-2 w-2 rounded-full",
                      getSeverityColor(req.severity),
                    )}
                  />
                  <span class="text-xs text-gray-400 capitalize">
                    {req.severity}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Risk metrics */}
        <div
          class="mb-4 grid flex-shrink-0 grid-cols-2 gap-3"
          style={{
            opacity: risksVisible() ? 1 : 0,
            transform: `translateY(${risksVisible() ? 0 : 20}px)`,
            transition: "all 0.6s ease-out",
          }}
        >
          <For each={RISK_METRICS}>
            {(metric, index) => (
              <div
                class="rounded-lg border border-gray-700 bg-gray-900/30 p-3"
                style={{
                  opacity:
                    risksVisible() && animationProgress() > 0.5 + index() * 0.05
                      ? 1
                      : 0,
                  transition: `opacity 0.4s ease-out ${index() * 100}ms`,
                }}
              >
                <div class="mb-1 flex items-center justify-between">
                  <div class="text-xs text-gray-400">{metric.label}</div>
                  {getTrendIcon(metric.trend)}
                </div>
                <div
                  class={clsx(
                    "text-2xl font-bold",
                    metric.label.includes("Critical") ||
                      metric.label.includes("Open")
                      ? "text-red-400"
                      : metric.label.includes("Days")
                        ? "text-orange-400"
                        : "text-yellow-400",
                  )}
                >
                  {metric.count}
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Urgent actions */}
        <div
          class="flex-shrink-0 space-y-2"
          style={{
            opacity: actionsVisible() ? 1 : 0,
            transform: `translateY(${actionsVisible() ? 0 : 20}px)`,
            transition: "all 0.6s ease-out",
          }}
        >
          <div class="mb-3 text-sm font-medium text-red-400">
            Urgent Actions Required:
          </div>
          <For each={URGENT_ACTIONS}>
            {(action, index) => (
              <div
                class={`
                  flex items-center gap-3 rounded-lg border border-red-800/30
                  bg-red-900/10 p-3 text-sm text-gray-300
                `}
                style={{
                  opacity:
                    actionsVisible() &&
                    animationProgress() > 0.75 + index() * 0.05
                      ? 1
                      : 0,
                  transition: `opacity 0.4s ease-out ${index() * 150}ms`,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  class="flex-shrink-0 text-red-400"
                >
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 9v4"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 17h.01"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {action}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );

  const backContent = (
    <div class="flex h-full w-full flex-col justify-center space-y-6">
      <div class="text-center">
        <h3 class="mb-4 text-2xl font-bold text-white">Compliance Gaps</h3>
        <p class="text-lg font-medium text-red-400">Risk Exposure</p>
      </div>

      <div class="space-y-4 text-white">
        <p class="text-base leading-relaxed">
          Compliance violations aren't just technical debt - they're business
          risks. Gaps expose organizations to:
        </p>

        <ul class="space-y-2 text-sm">
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Regulatory penalties and fines</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Security vulnerabilities</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Audit failures and remediation costs</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Loss of customer trust</span>
          </li>
        </ul>

        <p class="text-sm leading-relaxed text-gray-300">
          Proactive compliance management requires automated controls,
          continuous monitoring, and systematic risk mitigation strategies.
        </p>
      </div>
    </div>
  );

  return (
    <FlippableCard
      frontContent={frontContent}
      backContent={backContent}
      isVisible={props.isVisible}
    />
  );
};
