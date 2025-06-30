// Deployment speed visualization component showing slow pipeline performance
// Displays deployment timeline with bottlenecks and duration metrics

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

interface IDeploymentSpeedProps {
  isVisible?: boolean;
}

// ================================================================================================
// DATA CONFIGURATION CONSTANTS
// ================================================================================================

// Deployment pipeline stages with their durations
const PIPELINE_STAGES = [
  { name: "Build", duration: 8, status: "completed", color: "bg-green-500" },
  { name: "Test", duration: 25, status: "completed", color: "bg-yellow-500" },
  {
    name: "Security Scan",
    duration: 15,
    status: "running",
    color: "bg-blue-500",
  },
  {
    name: "Deploy Staging",
    duration: 12,
    status: "pending",
    color: "bg-gray-500",
  },
  { name: "E2E Tests", duration: 30, status: "pending", color: "bg-gray-500" },
  {
    name: "Deploy Prod",
    duration: 18,
    status: "pending",
    color: "bg-gray-500",
  },
];

const PERFORMANCE_METRICS = [
  { label: "Lead Time", value: "4.5 days", target: "< 1 day", status: "poor" },
  {
    label: "Deployment Frequency",
    value: "Weekly",
    target: "Daily",
    status: "poor",
  },
  {
    label: "Mean Time to Recovery",
    value: "8 hours",
    target: "< 1 hour",
    status: "poor",
  },
  {
    label: "Change Failure Rate",
    value: "23%",
    target: "< 5%",
    status: "poor",
  },
];

const BOTTLENECK_ISSUES = [
  "Manual approval gates",
  "Flaky test infrastructure",
  "Resource contention",
  "Complex rollback procedures",
];

const ANIMATION_DURATION = 3000;
const TOTAL_PIPELINE_TIME = PIPELINE_STAGES.reduce(
  (acc, stage) => acc + stage.duration,
  0,
);

export const DeploymentSpeed: Component<IDeploymentSpeedProps> = (props) => {
  const [animationProgress, setAnimationProgress] = createSignal(0);
  const [currentStage, setCurrentStage] = createSignal(0);
  const [metricsVisible, setMetricsVisible] = createSignal(false);

  let animationRef: number;
  let startTime: number;

  const getCurrentStageProgress = () => {
    const progress = animationProgress();
    const stageIndex = currentStage();

    if (stageIndex >= PIPELINE_STAGES.length) return 1;

    const completedTime = PIPELINE_STAGES.slice(0, stageIndex).reduce(
      (acc, stage) => acc + stage.duration,
      0,
    );
    const currentStageTime = PIPELINE_STAGES[stageIndex].duration;
    const stageProgress = Math.min(
      1,
      (progress * TOTAL_PIPELINE_TIME - completedTime) / currentStageTime,
    );

    return Math.max(0, stageProgress);
  };

  const getStageStatus = (index: number) => {
    const currentIdx = currentStage();
    if (index < currentIdx) return "completed";
    if (index === currentIdx) return "running";
    return "pending";
  };

  const resetAnimation = () => {
    if (animationRef) {
      cancelAnimationFrame(animationRef);
    }
    setAnimationProgress(0);
    setCurrentStage(0);
    setMetricsVisible(false);
  };

  const startAnimation = () => {
    startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      setAnimationProgress(progress);

      // Calculate which stage we're currently on
      const currentTime_pipeline = progress * TOTAL_PIPELINE_TIME;
      let accumulatedTime = 0;
      let stageIndex = 0;

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        if (
          currentTime_pipeline <=
          accumulatedTime + PIPELINE_STAGES[i].duration
        ) {
          stageIndex = i;
          break;
        }
        accumulatedTime += PIPELINE_STAGES[i].duration;
        stageIndex = i + 1;
      }

      setCurrentStage(Math.min(stageIndex, PIPELINE_STAGES.length - 1));

      if (progress > 0.3) {
        setMetricsVisible(true);
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
      }, 400);
    } else {
      resetAnimation();
    }
  });

  onMount(() => {
    // Start animation immediately if visible on mount
    if (props.isVisible !== false) {
      setTimeout(() => {
        startAnimation();
      }, 400);
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
      aria-label="Deployment pipeline dashboard showing slow deployment speeds and bottlenecks across multiple stages"
      style={{
        background: "#0a0e1a",
        "font-family":
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
      }}
    >
      {/* Screen reader content */}
      <div class="sr-only">
        <h3>Deployment Speed Analysis</h3>
        <p>Pipeline stages and performance metrics:</p>
        <ul>
          <For each={PIPELINE_STAGES}>
            {(stage) => (
              <li>
                {stage.name}: {stage.duration} minutes
              </li>
            )}
          </For>
        </ul>
        <p>Performance metrics:</p>
        <ul>
          <For each={PERFORMANCE_METRICS}>
            {(metric) => (
              <li>
                {metric.label}: {metric.value} (target: {metric.target})
              </li>
            )}
          </For>
        </ul>
        <p>Bottlenecks: {BOTTLENECK_ISSUES.join(", ")}</p>
      </div>

      <div
        class="relative flex h-full w-full max-w-2xl flex-col p-6"
        aria-hidden="true"
      >
        {/* Dashboard header */}
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-bold text-white">Deployment Pipeline</h3>
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <span class="text-sm text-orange-400">
              {Math.round(animationProgress() * TOTAL_PIPELINE_TIME)} /{" "}
              {TOTAL_PIPELINE_TIME} min
            </span>
          </div>
        </div>

        {/* Pipeline visualization */}
        <div class="mb-4 flex-shrink-0">
          <div class="mb-4 flex items-center justify-between">
            <For each={PIPELINE_STAGES}>
              {(stage, index) => (
                <div class="flex flex-1 flex-col items-center">
                  {/* Stage icon */}
                  <div
                    class={clsx(
                      `
                        mb-2 flex h-8 w-8 items-center justify-center
                        rounded-full border-2 transition-all duration-500
                      `,
                      getStageStatus(index()) === "completed"
                        ? "border-green-500 bg-green-500 text-white"
                        : getStageStatus(index()) === "running"
                          ? `
                            animate-pulse border-blue-500 bg-blue-500 text-white
                          `
                          : "border-gray-600 bg-gray-700 text-gray-400",
                    )}
                  >
                    {getStageStatus(index()) === "completed" ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    ) : getStageStatus(index()) === "running" ? (
                      <div class="h-3 w-3 animate-pulse rounded-full bg-white" />
                    ) : (
                      <div class="h-3 w-3 rounded-full bg-gray-500" />
                    )}
                  </div>

                  {/* Stage name */}
                  <div
                    class={clsx(
                      "mb-1 text-center text-xs font-medium",
                      getStageStatus(index()) === "completed"
                        ? "text-green-400"
                        : getStageStatus(index()) === "running"
                          ? "text-blue-400"
                          : "text-gray-500",
                    )}
                  >
                    {stage.name}
                  </div>

                  {/* Duration */}
                  <div class="text-xs text-gray-500">{stage.duration}m</div>

                  {/* Progress bar for current stage */}
                  {getStageStatus(index()) === "running" && (
                    <div
                      class={`
                        mt-2 h-1 w-full max-w-16 overflow-hidden rounded-full
                        bg-gray-700
                      `}
                    >
                      <div
                        class={`
                          h-full bg-blue-500 transition-all duration-300
                          ease-out
                        `}
                        style={{
                          width: `${getCurrentStageProgress() * 100}%`,
                        }}
                      />
                    </div>
                  )}

                  {/* Connection line */}
                  {index() < PIPELINE_STAGES.length - 1 && (
                    <div
                      class={clsx(
                        "absolute top-4 h-0.5 transition-colors duration-500",
                        getStageStatus(index()) === "completed"
                          ? "bg-green-500"
                          : "bg-gray-600",
                      )}
                      style={{
                        left: `${((index() + 1) / PIPELINE_STAGES.length) * 100 - 50 / PIPELINE_STAGES.length}%`,
                        width: `${100 / PIPELINE_STAGES.length - 8}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  )}
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Performance metrics */}
        <div
          class="mb-4 grid flex-1 grid-cols-2 gap-3"
          style={{
            opacity: metricsVisible() ? 1 : 0,
            transform: `translateY(${metricsVisible() ? 0 : 20}px)`,
            transition: "all 0.6s ease-out",
          }}
        >
          <For each={PERFORMANCE_METRICS}>
            {(metric, index) => (
              <div
                class="rounded-lg border border-red-800/30 bg-red-900/10 p-3"
                style={{
                  opacity:
                    metricsVisible() &&
                    animationProgress() > 0.4 + index() * 0.1
                      ? 1
                      : 0,
                  transition: `opacity 0.4s ease-out ${index() * 100}ms`,
                }}
              >
                <div class="mb-1 text-xs text-gray-400">{metric.label}</div>
                <div class="mb-1 text-lg font-bold text-red-400">
                  {metric.value}
                </div>
                <div class="text-xs text-gray-500">Target: {metric.target}</div>
              </div>
            )}
          </For>
        </div>

        {/* Bottleneck issues */}
        <div
          class="flex-shrink-0 space-y-2"
          style={{
            opacity: metricsVisible() ? 1 : 0,
            transform: `translateY(${metricsVisible() ? 0 : 20}px)`,
            transition: "all 0.6s ease-out 0.3s",
          }}
        >
          <div class="mb-2 text-sm font-medium text-orange-400">
            Identified Bottlenecks:
          </div>
          <For each={BOTTLENECK_ISSUES}>
            {(issue, index) => (
              <div
                class={`
                  flex items-center gap-2 rounded border border-orange-800/30
                  bg-orange-900/10 p-2 text-sm text-gray-300
                `}
                style={{
                  opacity:
                    metricsVisible() &&
                    animationProgress() > 0.6 + index() * 0.05
                      ? 1
                      : 0,
                  transition: `opacity 0.4s ease-out ${(index() + 3) * 100}ms`,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  class="flex-shrink-0 text-orange-400"
                >
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {issue}
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
        <h3 class="mb-4 text-2xl font-bold text-white">Deployment Speed</h3>
        <p class="text-lg font-medium text-red-400">
          The Innovation Bottleneck
        </p>
      </div>

      <div class="space-y-4 text-white">
        <p class="text-base leading-relaxed">
          Slow deployments kill innovation velocity. Every minute spent waiting
          for deployments is a minute not spent on customer value. Speed issues
          include:
        </p>

        <ul class="space-y-2 text-sm">
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Manual approval processes</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Fragile testing pipelines</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Complex rollback procedures</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Resource contention delays</span>
          </li>
        </ul>

        <p class="text-sm leading-relaxed text-gray-300">
          Fast, reliable deployments enable rapid iteration, quick fixes, and
          continuous delivery of value to customers.
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
