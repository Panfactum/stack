// Infrastructure Problems section component with animated problem list and dashboard
// Includes auto-progression, manual navigation, and visibility-based restart functionality
import { createVisibilityObserver } from "@solid-primitives/intersection-observer";
import { clsx } from "clsx";
import {
  createSignal,
  onMount,
  onCleanup,
  For,
  type Component,
} from "solid-js";

import { ComplianceGaps } from "./ComplianceGaps";
import { DeploymentSpeed } from "./DeploymentSpeed";
import { ObservabilityBlindspots } from "./ObservabilityBlindspots";
import { PlatformLimitations } from "./PlatformLimitations";
import { SpiralingCosts } from "./SpiralingCosts";

// ================================================================================================
// TIMING CONFIGURATION CONSTANTS
// ================================================================================================
// These constants control all animation timing and can be adjusted to fine-tune the user experience.
// Changes take effect immediately when saving the file - no restart required.

// CORE BEHAVIOR CONTROLS
// ================================================================================================

const ENABLE_AUTO_PROGRESSION = true;
// Controls whether the problems automatically progress through the list
// - IMPACT: When true, problems cycle automatically; when false, only manual navigation works
// - APPLIES TO: Mobile and desktop auto-progression behavior
// - EXAMPLES: true = auto-advancing slideshow, false = manual-only navigation

// CORE ANIMATION TIMING
// ================================================================================================

const FILL_DURATION = 6500;
// Controls how long it takes for each text element to fill completely from left to right (in milliseconds)
// - IMPACT: Longer values create a more leisurely, dramatic effect; shorter values feel snappier
// - RECOMMENDED RANGE: 2000-6000ms
// - EXAMPLES: 2500ms = fast/energetic, 4000ms = balanced, 6000ms = slow/dramatic

const FILL_UPDATE_INTERVAL = 50;
// Controls animation smoothness by setting how often the fill progress updates (in milliseconds)
// - IMPACT: Lower values = smoother animation but higher CPU usage; higher values = choppier but more performant
// - RECOMMENDED RANGE: 16-100ms
// - EXAMPLES: 16ms = 60fps (very smooth), 50ms = 20fps (balanced), 100ms = 10fps (performance mode)

// TRANSITION TIMING
// ================================================================================================

const FADE_DURATION = 750;
// Controls how long fade-out transitions take when elements become inactive (in milliseconds)
// - IMPACT: Affects how quickly filled elements disappear when moving to the next item
// - APPLIES TO: Both fill background and text opacity when transitioning away from an element
// - RECOMMENDED RANGE: 300-1500ms
// - EXAMPLES: 400ms = quick/snappy, 750ms = balanced, 1200ms = slow/smooth

const TEXT_TRANSITION_DURATION = 300;
// Controls text opacity changes when switching between active/inactive states (in milliseconds)
// - IMPACT: How quickly text dims/brightens when elements become active or inactive
// - APPLIES TO: Text color transitions when hovering or switching elements
// - RECOMMENDED RANGE: 200-500ms
// - EXAMPLES: 200ms = instant feedback, 300ms = balanced, 500ms = gentle transitions

const TRANSFORM_TRANSITION_DURATION = 50;
// Controls smoothness of the fill bar movement during active animation (in milliseconds)
// - IMPACT: Lower values = more responsive to progress updates; higher values = smoother but less precise tracking
// - APPLIES TO: The translateX animation of the fill background during active filling
// - RECOMMENDED RANGE: 100-300ms
// - EXAMPLES: 100ms = very responsive, 200ms = balanced, 300ms = smooth but less precise

// VISIBILITY DETECTION
// ================================================================================================

const VISIBILITY_THRESHOLD = 0.3;
// Percentage of section that must be visible to restart auto-progression (0.0 = 0%, 1.0 = 100%)
// - IMPACT: Lower values restart animation sooner when scrolling; higher values require more visibility
// - APPLIES TO: When user scrolls back to section after it was out of view
// - RECOMMENDED RANGE: 0.1-0.8
// - EXAMPLES: 0.1 = restart when barely visible, 0.3 = balanced, 0.8 = restart only when mostly visible

const VISIBILITY_ROOT_MARGIN = "0px 0px -100px 0px";
// Margin adjustment for visibility detection (top right bottom left format)
// - IMPACT: Negative bottom margin means animation restarts BEFORE section fully enters viewport
// - APPLIES TO: IntersectionObserver trigger distance
// - FORMAT: 'top right bottom left' (e.g., '0px 0px -100px 0px')
// - EXAMPLES: '0px 0px -50px 0px' = restart 50px early, '0px 0px -200px 0px' = restart 200px early

const MOBILE_PAUSE_DURATION = 400;
// Brief pause when element is fully filled before switching to next (in milliseconds)
// - IMPACT: Allows users to see the completed state briefly before transition
// - APPLIES TO: Only on mobile auto-progression, not desktop or manual navigation
// - RECOMMENDED RANGE: 50-300ms
// - EXAMPLES: 50ms = minimal pause, 100ms = brief moment, 300ms = longer pause

// ================================================================================================
// PRESET CONFIGURATIONS
// ================================================================================================
// Copy and paste these preset combinations for different animation feels:

// FAST/ENERGETIC PRESET:
// const FILL_DURATION = 2500;
// const FADE_DURATION = 400;
// const TEXT_TRANSITION_DURATION = 200;
// const TRANSFORM_TRANSITION_DURATION = 150;

// SLOW/DRAMATIC PRESET:
// const FILL_DURATION = 6000;
// const FADE_DURATION = 1200;
// const TEXT_TRANSITION_DURATION = 500;
// const TRANSFORM_TRANSITION_DURATION = 300;

// PERFORMANCE-OPTIMIZED PRESET:
// const FILL_UPDATE_INTERVAL = 100; // Reduces CPU usage
// const TRANSFORM_TRANSITION_DURATION = 300; // Compensates with smoother CSS transitions

// ================================================================================================

// Problems stack component with animation
const ProblemsStack: Component = () => {
  const [currentItem, setCurrentItem] = createSignal(0);
  const [fillProgress, setFillProgress] = createSignal(0);
  const [currentImage, setCurrentImage] = createSignal(0);
  const [isResetting, setIsResetting] = createSignal(false);
  const [isAutoProgressing, setIsAutoProgressing] = createSignal(
    ENABLE_AUTO_PROGRESSION,
  );
  const [fadingItems, setFadingItems] = createSignal<Map<number, number>>(
    new Map(),
  );
  const [startFading, setStartFading] = createSignal<Set<number>>(new Set());
  const [isPaused, setIsPaused] = createSignal(false);
  const [isCardFlipped, setIsCardFlipped] = createSignal(false);
  let intervalRef: ReturnType<typeof setInterval>;
  let sectionRef: HTMLDivElement | undefined;

  const problems = [
    "Spiraling Costs",
    "Observability Blindspots",
    "Platform Limitations",
    "Deployment Speed",
    "Compliance Gaps",
  ];

  const problemComponents = [
    SpiralingCosts,
    ObservabilityBlindspots,
    PlatformLimitations,
    DeploymentSpeed,
    ComplianceGaps,
  ];

  const goToNext = () => {
    setIsAutoProgressing(false);
    setIsResetting(true);
    setFillProgress(0);
    setIsCardFlipped(false); // Reset card flip state
    setCurrentItem((prev) => (prev + 1) % problems.length);
    setCurrentImage((prev) => (prev + 1) % problemComponents.length);
    // Use requestAnimationFrame to ensure DOM has updated before re-enabling transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsResetting(false);
      });
    });
  };

  const goToPrevious = () => {
    setIsAutoProgressing(false);
    setIsResetting(true);
    setFillProgress(0);
    setIsCardFlipped(false); // Reset card flip state
    setCurrentItem((prev) => (prev - 1 + problems.length) % problems.length);
    setCurrentImage(
      (prev) =>
        (prev - 1 + problemComponents.length) % problemComponents.length,
    );
    // Use requestAnimationFrame to ensure DOM has updated before re-enabling transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsResetting(false);
      });
    });
  };

  const goToItem = (index: number) => {
    setIsAutoProgressing(false);
    setIsCardFlipped(false); // Reset card flip state

    // Start fading out the current item if it's filled
    const previousItem = currentItem();
    const currentFillProgress = fillProgress();
    if (currentFillProgress > 0) {
      // Store the frozen fill progress for the fading item
      setFadingItems((prev) =>
        new Map(prev).set(previousItem, currentFillProgress),
      );

      // Start the fade transition
      requestAnimationFrame(() => {
        setStartFading((prev) => new Set(prev).add(previousItem));
      });

      // Remove from both after fade completes
      setTimeout(() => {
        setFadingItems((prev) => {
          const newMap = new Map(prev);
          newMap.delete(previousItem);
          return newMap;
        });
        setStartFading((prev) => {
          const newSet = new Set(prev);
          newSet.delete(previousItem);
          return newSet;
        });
      }, FADE_DURATION);
    }

    setIsResetting(true);
    setFillProgress(0);
    setCurrentItem(index);
    setCurrentImage(index);
    // Use requestAnimationFrame to ensure DOM has updated before re-enabling transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsResetting(false);
      });
    });
  };

  onMount(() => {
    // Set CSS variables from JavaScript constants
    sectionRef?.style.setProperty("--fade-duration", `${FADE_DURATION}ms`);
    sectionRef?.style.setProperty(
      "--text-transition-duration",
      `${TEXT_TRANSITION_DURATION}ms`,
    );
    sectionRef?.style.setProperty(
      "--transform-transition-duration",
      `${TRANSFORM_TRANSITION_DURATION}ms`,
    );

    const incrementPerUpdate = 100 / (FILL_DURATION / FILL_UPDATE_INTERVAL); // Percentage to add each update

    // Set up auto-progression interval
    intervalRef = setInterval(() => {
      if (!isAutoProgressing() || isPaused() || isCardFlipped()) return;

      setFillProgress((prev) => {
        const newProgress = prev + incrementPerUpdate;

        if (newProgress >= 100) {
          // Element is full, pause before transitioning
          setIsPaused(true);
          const currentItemIndex = currentItem();

          // Store the full progress for fading
          setFadingItems((prev) => new Map(prev).set(currentItemIndex, 100));

          // Add pause before starting fade and moving to next item
          setTimeout(() => {
            // Start the fade transition
            requestAnimationFrame(() => {
              setStartFading((prev) => new Set(prev).add(currentItemIndex));
            });

            // Remove from both after fade completes
            setTimeout(() => {
              setFadingItems((prev) => {
                const newMap = new Map(prev);
                newMap.delete(currentItemIndex);
                return newMap;
              });
              setStartFading((prev) => {
                const newSet = new Set(prev);
                newSet.delete(currentItemIndex);
                return newSet;
              });
            }, FADE_DURATION);

            // Move to next item
            setCurrentItem((prev) => (prev + 1) % problems.length);
            setCurrentImage((prev) => (prev + 1) % problemComponents.length);
            setFillProgress(0);
            setIsCardFlipped(false); // Reset card flip state
            setIsPaused(false);
          }, MOBILE_PAUSE_DURATION);

          return 100; // Keep at 100% during pause
        }

        return newProgress;
      });
    }, FILL_UPDATE_INTERVAL);

    // Set up visibility observer to restart auto-progression when section comes back into view
    const useVisibilityObserver = createVisibilityObserver(
      {
        threshold: VISIBILITY_THRESHOLD,
        rootMargin: VISIBILITY_ROOT_MARGIN,
      },
      (entry) => {
        if (entry.isIntersecting) {
          setIsAutoProgressing(true);
        }
        return entry.isIntersecting;
      },
    );

    // Observe the section element
    useVisibilityObserver(() => sectionRef);

    onCleanup(() => {
      clearInterval(intervalRef);
    });
  });

  return (
    <div
      ref={sectionRef}
      class={`
        grid grid-cols-1 items-center gap-8
        lg:grid-cols-3
      `}
    >
      {/* Left side - Problems list with mobile controls */}
      <div
        class={`
          flex flex-col gap-4
          lg:col-span-1
        `}
      >
        {/* Mobile layout with side buttons */}
        <div class="lg:hidden">
          <div class="flex items-center gap-4">
            {/* Left button */}
            <button
              onClick={goToPrevious}
              class={`
                flex h-10 w-10 flex-shrink-0 items-center justify-center
                rounded-lg border border-gray-dark-mode-600
                bg-gray-dark-mode-800 text-white transition-colors
                hover:bg-gray-dark-mode-700
              `}
              aria-label="Previous problem"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            {/* Current text element */}
            <div class="relative flex-1 overflow-hidden rounded-lg px-6 py-4">
              {/* Background fill that animates from left to right */}
              <div
                class={clsx(
                  "absolute inset-0 bg-secondary",
                  !isResetting() && "transition-transform ease-linear",
                )}
                style={{
                  transform: `translateX(${fillProgress() - 100}%)`,
                  "transition-duration": !isResetting()
                    ? "var(--transform-transition-duration)"
                    : "0ms",
                }}
              />
              {/* Text and dots container */}
              <div class="relative z-10 flex items-center justify-between">
                {/* Text content */}
                <span class="text-display-xs font-medium text-white">
                  {problems[currentItem()]}
                </span>
                {/* Dots indicator */}
                <div class="flex gap-2">
                  <For each={problems}>
                    {(_, index) => (
                      <div
                        class={clsx(
                          "h-2 w-2 rounded-full transition-colors duration-200",
                          index() === currentItem()
                            ? "bg-white"
                            : "bg-gray-dark-mode-600",
                        )}
                      />
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Right button */}
            <button
              onClick={goToNext}
              class={`
                flex h-10 w-10 flex-shrink-0 items-center justify-center
                rounded-lg border border-gray-dark-mode-600
                bg-gray-dark-mode-800 text-white transition-colors
                hover:bg-gray-dark-mode-700
              `}
              aria-label="Next problem"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop layout - all problems visible and clickable */}
        <div
          class={`
            hidden flex-col gap-4
            lg:flex
          `}
        >
          <For each={problems}>
            {(problem, index) => (
              <button
                onClick={() => {
                  goToItem(index());
                }}
                class={clsx(
                  `
                    relative cursor-pointer overflow-hidden rounded-lg px-6 py-4
                    text-left transition-colors duration-200
                  `,
                  index() !== currentItem() && "hover:bg-brand-800/50",
                )}
              >
                {/* Background fill that animates from left to right */}
                <div
                  class={clsx(
                    "pointer-events-none absolute inset-0 bg-brand-800",
                    index() === currentItem() &&
                      "transition-transform ease-linear",
                    fadingItems().has(index()) && "transition-opacity",
                  )}
                  style={{
                    transform:
                      index() === currentItem()
                        ? `translateX(${fillProgress() - 100}%)`
                        : fadingItems().has(index())
                          ? `translateX(${(fadingItems().get(index()) || 0) - 100}%)`
                          : "translateX(-100%)",
                    opacity: startFading().has(index()) ? 0 : 1,
                    "transition-duration":
                      index() === currentItem()
                        ? "var(--transform-transition-duration)"
                        : fadingItems().has(index())
                          ? "var(--fade-duration)"
                          : undefined,
                  }}
                />
                {/* Text content */}
                <span
                  class={clsx(
                    `
                      pointer-events-none relative z-10 text-display-xs
                      font-medium
                    `,
                    index() === currentItem()
                      ? "text-white opacity-100 transition-opacity"
                      : fadingItems().has(index())
                        ? "text-white transition-opacity"
                        : "text-white opacity-30 transition-opacity",
                  )}
                  style={{
                    opacity: startFading().has(index()) ? 0.3 : undefined,
                    "transition-duration":
                      index() === currentItem()
                        ? "var(--text-transition-duration)"
                        : fadingItems().has(index())
                          ? "var(--fade-duration)"
                          : "var(--text-transition-duration)",
                  }}
                >
                  {problem}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Right side - Problem visualization components */}
      <div
        class={`
          relative h-96 w-full rounded-xl
          lg:col-span-2
        `}
        style={{ overflow: "visible" }}
        onMouseEnter={() => setIsAutoProgressing(false)}
        onMouseLeave={() => {
          if (!isCardFlipped()) {
            setIsAutoProgressing(true);
          }
        }}
      >
        {(() => {
          const CurrentComponent = problemComponents[currentImage()];
          // Create a wrapper to intercept the FlippableCard
          return (
            <button
              class={`
                h-full w-full cursor-pointer border-0 bg-transparent p-0
                text-left
              `}
              onClick={() => {
                // Set auto-progressing to false on click
                setIsAutoProgressing(false);
                // Toggle flip state
                setIsCardFlipped(!isCardFlipped());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsAutoProgressing(false);
                  setIsCardFlipped(!isCardFlipped());
                }
              }}
              type="button"
              aria-label="Toggle problem card details"
            >
              <CurrentComponent isVisible={true} />
            </button>
          );
        })()}
      </div>
    </div>
  );
};

export const InfrastructureProblemsSection: Component = () => {
  return (
    <section
      class={`
        mx-auto max-w-screen-2xl px-6 py-20
        md:px-10
        lg:px-16
      `}
    >
      <div class="mb-16 text-center">
        <h2 class="mb-6 font-machina text-display-lg font-bold text-white">
          Got Cloud Problems?
        </h2>
        <p class="mx-auto max-w-4xl text-display-sm text-secondary">
          The cloud should be easy&mdash;but public clouds are hurting your
          velocity, inflating your costs, and distracting your team from
          shipping.
        </p>
      </div>

      <div class="mb-16">
        <ProblemsStack />
      </div>
    </section>
  );
};
