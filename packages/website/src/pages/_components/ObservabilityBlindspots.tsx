// Observability blindspots visualization component showing monitoring gaps
// Displays metrics dashboard with missing data and blind spots indicators

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

interface IObservabilityBlindspotsProps {
  isVisible?: boolean;
}

// ================================================================================================
// DATA CONFIGURATION CONSTANTS
// ================================================================================================

// Service health data that starts healthy and degrades
const getServiceHealthData = (progress: number) => {
  // Progress thresholds for degradation
  const degradationStart = 0.15; // Start degrading at ~1.2 seconds
  const fullDegradation = 0.5; // Fully degraded by 4 seconds

  if (progress < degradationStart) {
    // Starting state - some metrics already missing
    return [
      {
        name: "API Server",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      {
        name: "PostgreSQL",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      {
        name: "Redis Cache",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
      {
        name: "Website",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      {
        name: "Auth Service",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      {
        name: "Monitoring",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
    ];
  } else if (progress < fullDegradation) {
    // Progressive degradation
    const degradationProgress =
      (progress - degradationStart) / (fullDegradation - degradationStart);
    return [
      {
        name: "API Server",
        value:
          degradationProgress > 0.8
            ? "Outage"
            : degradationProgress > 0.3
              ? "Degraded"
              : "Healthy",
        status:
          degradationProgress > 0.8
            ? "outage"
            : degradationProgress > 0.3
              ? "partial"
              : "available",
        color:
          degradationProgress > 0.8
            ? "bg-red-600"
            : degradationProgress > 0.3
              ? "bg-yellow-600"
              : "bg-green-600",
      },
      {
        name: "PostgreSQL",
        value:
          degradationProgress > 0.5
            ? "Outage"
            : degradationProgress > 0.2
              ? "Slow"
              : "Healthy",
        status:
          degradationProgress > 0.5
            ? "outage"
            : degradationProgress > 0.2
              ? "partial"
              : "available",
        color:
          degradationProgress > 0.5
            ? "bg-red-600"
            : degradationProgress > 0.2
              ? "bg-yellow-600"
              : "bg-green-600",
      },
      // Redis Cache - already missing, stays missing
      {
        name: "Redis Cache",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
      {
        name: "Website",
        value:
          degradationProgress > 0.7
            ? "Outage"
            : degradationProgress > 0.4
              ? "Lagging"
              : "Healthy",
        status:
          degradationProgress > 0.7
            ? "outage"
            : degradationProgress > 0.4
              ? "partial"
              : "available",
        color:
          degradationProgress > 0.7
            ? "bg-red-600"
            : degradationProgress > 0.4
              ? "bg-yellow-600"
              : "bg-green-600",
      },
      {
        name: "Auth Service",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      // Monitoring - already missing, stays missing
      {
        name: "Monitoring",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
    ];
  } else {
    // Fully degraded
    return [
      {
        name: "API Server",
        value: "Outage",
        status: "outage",
        color: "bg-red-600",
      },
      {
        name: "PostgreSQL",
        value: "Outage",
        status: "outage",
        color: "bg-red-600",
      },
      {
        name: "Redis Cache",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
      {
        name: "Website",
        value: "Outage",
        status: "outage",
        color: "bg-red-600",
      },
      {
        name: "Auth Service",
        value: "Healthy",
        status: "available",
        color: "bg-green-600",
      },
      {
        name: "Monitoring",
        value: "Unknown",
        status: "missing",
        color: "bg-gray-600",
      },
    ];
  }
};

// Generate 50 unique alerts with exponentially decreasing delays
const generateAlertDelays = () => {
  const alertMessages = [
    "Service dependencies unknown",
    "No trace correlation configured",
    "Missing business metrics",
    "Blind to user experience metrics",
    "Database connection pool exhausted",
    "Primary database unreachable",
    "Replica lag exceeding 5 minutes",
    "Disk space critically low on /var",
    "Memory usage at 95%",
    "CPU throttling affecting performance",
    "Load balancer health checks failing",
    "DNS resolution timeouts",
    "Network packet loss above 5%",
    "Container restart loop detected",
    "Pod evictions increasing",
    "Node memory pressure",
    "Payment processing errors spike",
    "User registration failures",
    "ETL job failed 3 times",
    "Data warehouse sync broken",
    "Cache miss rate exceeding 40%",
    "External API response time degraded",
    "Message queue backlog growing",
    "Rate limiting triggered on API gateway",
    "Authentication service experiencing delays",
    "Log ingestion pipeline lagging",
    "Elasticsearch indexing slowed",
    "Redis latency spike detected",
    "MongoDB write concerns failing",
    "Kafka consumer lag increasing",
    "SSL certificate expires in 7 days",
    "CDN origin errors increasing",
    "Cross-region latency elevated",
    "VPN tunnel unstable",
    "Firewall rule conflicts detected",
    "NAT gateway at capacity",
    "BGP route flapping observed",
    "Persistent volume claims pending",
    "Service mesh sidecar errors",
    "Ingress controller overloaded",
    "Suspicious login attempts detected",
    "WAF blocking legitimate traffic",
    "Encryption key rotation failed",
    "Auto-scaling group not responding",
    "Prometheus scraping failing",
    "Grafana datasource disconnected",
    "Session management errors",
    "API versioning conflicts",
    "Streaming pipeline backpressure",
    "Data quality checks failing",
    "Schema migration pending",
    "Batch processing delayed",
    "Data retention policy violation",
    "Analytics dashboard stale",
    "Real-time aggregation lagging",
    "Data lake storage quota reached",
    "Security scan found vulnerabilities",
    "Compliance audit trail incomplete",
    "Access logs not being collected",
    "CORS policy misconfigured",
    "API key usage anomaly",
    "Failed security health check",
    "Privileged account activity spike",
    "Lambda function cold starts excessive",
    "S3 bucket replication failing",
    "CloudFront distribution errors",
    "RDS backup window missed",
    "EBS volume IOPS throttled",
    "Spot instance termination warning",
    "Reserved instance underutilized",
    "Cost anomaly detected",
    "Service quota limit approaching",
    "Distributed tracing incomplete",
    "Custom metrics not reporting",
    "Log aggregation missing sources",
    "Health check endpoints timeout",
  ];

  // Create alerts with randomized severity - only use first 50
  const alerts = alertMessages.slice(0, 50).map((message) => ({
    message,
    severity: Math.random() > 0.4 ? "warning" : "critical", // 40% critical, 60% warning
  }));

  // Special timing: 3 alerts in first 2 seconds, then accelerate
  const alertsWithDelays = [];
  let currentTime = 0;

  for (let i = 0; i < alerts.length; i++) {
    // Calculate delay as fraction of 8 seconds
    const delay = currentTime / 8;

    alertsWithDelays.push({
      ...alerts[i],
      delay: Math.min(delay, 0.999), // Cap at 0.999 to ensure it's within animation
    });

    // Calculate gap to next alert
    if (i < 3) {
      // First 3 alerts: appear slowly over 2 seconds
      // Gaps of approximately 0.7 seconds each
      currentTime += 0.7;
    } else {
      // After 2 seconds: accelerate from 0.2s to 0.05s gaps
      const adjustedIndex = i - 3;
      const remainingAlerts = alerts.length - 3;
      const progress = adjustedIndex / (remainingAlerts - 1);
      // Exponential acceleration
      const gap = 0.2 - 0.17 * Math.pow(progress, 1.4);
      currentTime += gap;
    }
  }

  return alertsWithDelays;
};

const ALERT_MESSAGES = generateAlertDelays();

const ANIMATION_DURATION = 8000;

export const ObservabilityBlindspots: Component<
  IObservabilityBlindspotsProps
> = (props) => {
  const [animationProgress, setAnimationProgress] = createSignal(0);

  let animationRef: number;
  let startTime: number;

  const resetAnimation = () => {
    if (animationRef) {
      cancelAnimationFrame(animationRef);
    }
    setAnimationProgress(0);
  };

  const startAnimation = () => {
    startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      setAnimationProgress(progress);

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
      }, 200);
    } else {
      resetAnimation();
    }
  });

  onMount(() => {
    // Start animation immediately if visible on mount
    if (props.isVisible !== false) {
      setTimeout(() => {
        startAnimation();
      }, 200);
    }
  });

  onCleanup(() => {
    if (animationRef) {
      cancelAnimationFrame(animationRef);
    }
  });

  const frontContent = (
    <div
      class="relative flex h-full w-full"
      role="img"
      aria-label="Observability dashboard showing blind spots and missing monitoring data across multiple service metrics"
      style={{
        background: "#0a0e1a",
        "font-family":
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      {/* Screen reader content */}
      <div class="sr-only">
        <h3>Observability Blindspots Dashboard</h3>
        <p>Monitoring dashboard showing gaps in observability:</p>
        <ul>
          <For each={getServiceHealthData(animationProgress())}>
            {(service) => (
              <li>
                {service.name}: {service.value} ({service.status})
              </li>
            )}
          </For>
        </ul>
        <p>
          Critical alerts: {ALERT_MESSAGES.map((a) => a.message).join(", ")}
        </p>
      </div>

      {/* Left column - Dashboard */}
      <div class="flex w-1/2 flex-col p-6" aria-hidden="true">
        {/* Dashboard header */}
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-bold text-white">Service Monitoring</h3>
          <div class="flex items-center gap-2">
            <div
              class={clsx(
                "h-2 w-2 rounded-full",
                animationProgress() < 0.15
                  ? "bg-green-500"
                  : animationProgress() < 0.5
                    ? "animate-pulse bg-yellow-500"
                    : "animate-pulse bg-red-500",
              )}
            />
            <span
              class={clsx(
                "text-sm",
                animationProgress() < 0.15
                  ? "text-green-400"
                  : animationProgress() < 0.5
                    ? "text-yellow-400"
                    : "text-red-400",
              )}
            >
              {animationProgress() < 0.15
                ? "Healthy"
                : animationProgress() < 0.5
                  ? "Warning"
                  : "Degraded"}
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        <div class="grid flex-1 grid-cols-2 gap-3">
          <For each={getServiceHealthData(animationProgress())}>
            {(metric) => (
              <div
                class={`
                  relative rounded-lg border border-gray-700 p-4 transition-all
                  duration-500
                `}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                }}
              >
                {/* Overlay for missing/outage states */}
                {(metric.status === "missing" ||
                  metric.status === "outage") && (
                  <div
                    class={clsx(
                      "absolute inset-0 rounded-lg border",
                      metric.status === "outage"
                        ? "border-red-500/50 bg-red-900/30"
                        : "border-gray-500/30 bg-gray-900/20",
                    )}
                    style={{
                      transition: "opacity 0.5s ease-out",
                    }}
                  >
                    <div class={`absolute right-2 bottom-2`}>
                      {metric.status === "outage" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          class="text-red-500"
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
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          class="text-gray-400"
                        >
                          <path
                            d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                )}

                <div class="mb-1 text-sm text-gray-400">{metric.name}</div>
                <div
                  class={clsx(
                    "text-2xl font-bold",
                    metric.value === "Outage"
                      ? "text-red-400"
                      : metric.status === "missing"
                        ? "text-gray-500"
                        : metric.status === "partial"
                          ? "text-yellow-400"
                          : "text-green-400",
                  )}
                >
                  {metric.value}
                </div>

                {/* Status indicator */}
                <div class="mt-2 flex items-center gap-2">
                  <div
                    class={clsx(
                      "h-2 w-2 rounded-full",
                      metric.status === "outage"
                        ? "animate-pulse bg-red-500"
                        : metric.status === "missing"
                          ? "bg-gray-500"
                          : metric.status === "partial"
                            ? "bg-yellow-500"
                            : "bg-green-500",
                    )}
                  />
                  <span class="text-xs text-gray-500 capitalize">
                    {metric.status}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Right column - Scrolling alerts */}
      <div class="flex w-1/2 flex-col border-l border-gray-800 p-6">
        <div class="mb-4 text-lg font-medium text-white">
          <span>Alerts</span>
          {animationProgress() > 0.25 && (
            <span
              class="ml-1 text-red-400"
              style={{
                opacity: Math.min((animationProgress() - 0.25) / 0.0625, 1), // 0.0625 = 500ms / 8000ms
                transition: "opacity 500ms ease-in",
              }}
            >
              Overload
            </span>
          )}
        </div>

        <div class="relative flex-1 overflow-hidden">
          <div class="absolute inset-0 flex flex-col">
            <For each={ALERT_MESSAGES.slice().reverse()}>
              {(alert, index) => {
                const isVisible = () => animationProgress() > alert.delay;
                return (
                  <div
                    class={clsx(
                      `
                        flex items-start gap-3 rounded-lg border p-3 text-sm
                        text-gray-300
                      `,
                      alert.severity === "critical"
                        ? "border-red-800/30 bg-red-900/10"
                        : "border-yellow-800/30 bg-yellow-900/10",
                      !isVisible() && "hidden",
                    )}
                    style={{
                      animation: isVisible()
                        ? "slideDown 0.4s ease-out"
                        : "none",
                      "margin-bottom": "0.75rem",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      class={clsx(
                        "flex-shrink-0",
                        alert.severity === "critical"
                          ? "text-red-400"
                          : "text-yellow-400",
                      )}
                    >
                      {alert.severity === "critical" ? (
                        <>
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
                        </>
                      ) : (
                        <path
                          d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      )}
                    </svg>
                    <div class="flex-1">
                      <div class="font-medium">{alert.message}</div>
                      <div class="mt-1 text-xs text-gray-500">
                        {alert.severity === "critical" ? "Critical" : "Warning"}{" "}
                        -{" "}
                        {new Date(
                          Date.now() - index() * 60000,
                        ).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
          <style>{`
            @keyframes slideDown {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );

  const backContent = (
    <div class="flex h-full w-full flex-col justify-center space-y-6">
      <div class="text-center">
        <h3 class="mb-4 text-2xl font-bold text-white">
          Observability Blindspots
        </h3>
        <p class="text-lg font-medium text-red-400">The Hidden Dangers</p>
      </div>

      <div class="space-y-4 text-white">
        <p class="text-base leading-relaxed">
          Without comprehensive monitoring, you're flying blind. Missing metrics
          mean incidents go undetected until they impact users. Gaps in
          observability lead to:
        </p>

        <ul class="space-y-2 text-sm">
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Delayed incident response</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Difficulty in root cause analysis</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Inability to proactively prevent issues</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Poor user experience due to unmonitored failures</span>
          </li>
        </ul>

        <p class="text-sm leading-relaxed text-gray-300">
          Modern systems require telemetry across all layers - metrics, logs,
          traces, and business KPIs. Don't let blind spots become business
          risks.
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
