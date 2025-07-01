// AWS Costs visualization component showing month over month cost growth
// Converted from standalone HTML to SolidJS with preserved animations and styling

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
import styles from "./SpiralingCosts.module.css";

// ================================================================================================
// COMPONENT PROPS INTERFACE
// ================================================================================================

interface ISpiralingCostsProps {
  isVisible?: boolean;
}

// ================================================================================================
// DATA CONFIGURATION CONSTANTS
// ================================================================================================

// Generate cost data with current month context
const generateCostData = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthAbbreviations = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const costData = [];
  const baseAmounts = [1200, 1450, 1800, 2200, 2700, 3300, 4100, 5100];

  // Custom text for each bar - can be customized per use case
  const customTexts = [
    "Starting baseline costs",
    "Developer Resources Left Running",
    "Left Free Tier",
    "Forgot to Rightsize",
    "Added CI/CD",
    "Staging Environment Deployed",
    "Added Logging and Monitoring",
    "Expensive Compliance Upgrades",
  ];

  for (let i = 0; i < 8; i++) {
    const monthIndex = (currentMonth - 7 + i + 12) % 12; // Start 7 months ago so current month is last
    const isActual = i < 6; // First 6 months are actual, last 2 are projected

    costData.push({
      month: monthNames[monthIndex],
      monthAbbr: monthAbbreviations[monthIndex],
      amount: baseAmounts[i],
      actual: isActual,
      customText: customTexts[i],
    });
  }

  return costData;
};

const COST_DATA = generateCostData();

// Growth percentage value for animation
const GROWTH_PERCENTAGE = 438;

// Animation timing configuration
const ANIMATION_DURATION = 2000; // Total animation duration in milliseconds
const STAGGER_DELAY = 0.2; // Delay between bar animations (as fraction)

export const SpiralingCosts: Component<ISpiralingCostsProps> = (props) => {
  const [shouldAnimate, setShouldAnimate] = createSignal(false);
  const [animatedPercentage, setAnimatedPercentage] = createSignal(0);
  const [numberColor, setNumberColor] = createSignal("rgb(0, 123, 255)");
  const [animationComplete, setAnimationComplete] = createSignal(false);
  const [_hoveredBar, setHoveredBar] = createSignal<number | null>(null);
  const [displayedBar, setDisplayedBar] = createSignal<number | null>(null);

  let containerRef: HTMLDivElement | undefined;
  let numberAnimationRef: number;
  let hoverTimeoutRef: ReturnType<typeof setTimeout>;

  // Calculate maximum and minimum amounts for scaling
  const maxAmount = Math.max(...COST_DATA.map((d) => d.amount)) - 1000;
  const minAmount = Math.min(...COST_DATA.map((d) => d.amount));

  // Calculate target height for each bar
  const getTargetHeight = (index: number) => {
    // Make the last bar overflow by 60%
    const baseHeight = (COST_DATA[index].amount / maxAmount) * 280;
    return Math.max(0, baseHeight); // No minimum height
  };

  // Calculate color based on cost amount with smooth interpolation (blue -> red)
  const getBarColor = (amount: number) => {
    // Normalize ratio so minimum amount = 0, maximum amount = 1
    const ratio = (amount - minAmount) / (maxAmount - minAmount);

    // Start red transition earlier - accelerate the ratio
    const t = Math.pow(ratio, 0.45); // Makes transition faster
    // Brand color rgb(80, 169, 230) to red rgb(239, 68, 68) - using brand-400
    const r = Math.round(80 + (239 - 80) * t);
    const g = Math.round(169 + (68 - 169) * t);
    const b = Math.round(230 + (68 - 230) * t);

    // Create darker shade for gradient bottom (subtract 60 instead of 40 for more contrast)
    const color1 = `rgb(${Math.max(r - 60, 0)}, ${Math.max(g - 60, 0)}, ${Math.max(b - 60, 0)})`;
    const color2 = `rgb(${r}, ${g}, ${b})`;

    return {
      background: `linear-gradient(to top, ${color1}, ${color2})`,
      mainColor: `rgb(${r}, ${g}, ${b})`,
    };
  };

  // Get the color of the last (highest cost) bar
  const getLastBarColor = () => {
    const lastBarAmount = COST_DATA[COST_DATA.length - 1].amount;
    return getBarColor(lastBarAmount).mainColor;
  };

  const resetAnimation = () => {
    setShouldAnimate(false);
    setAnimatedPercentage(0);
    setNumberColor("rgb(0, 123, 255)");
    setAnimationComplete(false);
    setHoveredBar(null);
    setDisplayedBar(null);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (numberAnimationRef) {
      cancelAnimationFrame(numberAnimationRef);
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
    }
  };

  const startAnimation = () => {
    setShouldAnimate(true);

    // Start number animation at the same time as bars
    const startTime = performance.now();
    const totalAnimationTime =
      ANIMATION_DURATION +
      (COST_DATA.length - 1) * STAGGER_DELAY * ANIMATION_DURATION;
    const numberDuration = totalAnimationTime; // Match the total bar animation duration

    const animateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;

      // Linear progression for consistent speed
      const linearProgress = elapsed / numberDuration;

      if (linearProgress <= 1) {
        // Initial animation to target percentage - linear, no easing
        setAnimatedPercentage(Math.round(GROWTH_PERCENTAGE * linearProgress));
      } else {
        // Continue with the same speed after reaching target
        const totalProgress = linearProgress * GROWTH_PERCENTAGE;
        setAnimatedPercentage(Math.round(totalProgress));
      }

      // Transition color from blue to the last bar's color
      const targetColor = getLastBarColor();

      // Parse RGB values
      const startRGB = [0, 123, 255];
      const targetRGB = targetColor.match(/\d+/g)?.map(Number) || [239, 68, 68];

      // Interpolate color with easing for smooth color transition
      const colorProgress = Math.min(elapsed / numberDuration, 1);
      const easedColor = 1 - Math.pow(1 - colorProgress, 3);
      const r = Math.round(
        startRGB[0] + (targetRGB[0] - startRGB[0]) * easedColor,
      );
      const g = Math.round(
        startRGB[1] + (targetRGB[1] - startRGB[1]) * easedColor,
      );
      const b = Math.round(
        startRGB[2] + (targetRGB[2] - startRGB[2]) * easedColor,
      );

      setNumberColor(`rgb(${r}, ${g}, ${b})`);

      // Continue animation indefinitely
      numberAnimationRef = requestAnimationFrame(animateNumber);

      if (colorProgress >= 1 && !animationComplete()) {
        // Mark animation as complete for smooth hover transitions
        setTimeout(() => {
          setAnimationComplete(true);
        }, 100);
      }
    };

    numberAnimationRef = requestAnimationFrame(animateNumber);
  };

  // Restart animation when component becomes visible
  createEffect(() => {
    if (props.isVisible) {
      resetAnimation();
      setTimeout(() => {
        startAnimation();
      }, 100);
    } else {
      resetAnimation();
    }
  });

  onMount(() => {
    // Start animation immediately if visible on mount
    if (props.isVisible !== false) {
      setTimeout(() => {
        startAnimation();
      }, 100);
    }
  });

  const handleBarHover = (index: number) => {
    setHoveredBar(index);
    setDisplayedBar(index);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
    }
  };

  const handleBarLeave = () => {
    setHoveredBar(null);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
    }
    hoverTimeoutRef = setTimeout(() => {
      setDisplayedBar(null);
    }, 300);
  };

  onCleanup(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (numberAnimationRef) {
      cancelAnimationFrame(numberAnimationRef);
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
    }
  });

  const frontContent = (
    <div
      ref={containerRef}
      class="relative flex h-full w-full items-center justify-center bg-primary"
      role="img"
      aria-label="AWS cost growth chart showing spiraling costs from January to August, with costs increasing from $1,200 to $5,100, representing a 183% year-to-date increase"
    >
      {/* Screen reader content */}
      <div class="sr-only">
        <h3>AWS Cost Growth Analysis</h3>
        <p>Monthly AWS costs showing dramatic increase over 8 months:</p>
        <ul>
          <For each={COST_DATA}>
            {(item) => (
              <li>
                {item.month}: ${item.amount.toLocaleString()}{" "}
                {item.actual ? "(actual)" : "(projected)"}
              </li>
            )}
          </For>
        </ul>
        <p>Total growth: +{GROWTH_PERCENTAGE}%</p>
      </div>

      <div
        class="relative flex h-full w-full max-w-2xl flex-col overflow-hidden"
        aria-hidden="true"
      >
        <div class="relative w-full flex-1">
          {/* YoY Growth indicator or hovered bar info - overlaid on chart */}
          <div class="absolute top-10 left-10 z-10 min-w-lg">
            <div>
              {/* Cost Growth Display - Always visible */}
              <div class="mb-1 text-base text-secondary">Cost Growth</div>
              <div class="text-4xl font-bold" style={{ color: numberColor() }}>
                +{animatedPercentage()}%
              </div>

              {/* Bar Info Display - Shows below on hover */}
              <div
                class="mt-3 transition-opacity duration-300"
                style={{ opacity: displayedBar() !== null ? 1 : 0 }}
              >
                {displayedBar() !== null && (
                  <div
                    class={`text-lg leading-tight font-medium text-error-400`}
                  >
                    {COST_DATA[displayedBar() ?? 0].customText}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart container */}
          <div
            class="relative h-full"
            role="presentation"
            aria-label="Bar chart showing monthly AWS costs"
          >
            <div class="absolute inset-0 flex items-end gap-2 px-8 pb-6">
              <For each={COST_DATA}>
                {(item, index) => (
                  <div
                    class="relative flex flex-1 flex-col items-center"
                    role="presentation"
                  >
                    {/* Bar */}
                    <div
                      class={clsx(
                        `
                          relative w-full cursor-pointer rounded-t-lg
                          transition-all duration-300
                        `,
                        shouldAnimate() ? styles.barAnimate : "",
                        animationComplete() ? styles.animationComplete : "",
                      )}
                      role="presentation"
                      aria-label={`${item.month} cost: $${item.amount.toLocaleString()} ${item.actual ? "actual" : "projected"}`}
                      onMouseEnter={() => {
                        handleBarHover(index());
                      }}
                      onMouseLeave={handleBarLeave}
                      style={{
                        "--target-height": `${getTargetHeight(index())}px`,
                        "--animation-duration": `${ANIMATION_DURATION}ms`,
                        "animation-delay": shouldAnimate()
                          ? `${index() * STAGGER_DELAY * ANIMATION_DURATION}ms`
                          : undefined,
                        ...{ background: getBarColor(item.amount).background },
                        opacity: item.actual ? 1 : 0.6,
                      }}
                    />
                    {/* Month label */}
                    <div
                      class="mt-4 text-center text-sm text-secondary"
                      aria-hidden="true"
                    >
                      {item.monthAbbr}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const backContent = (
    <div class="flex h-full w-full flex-col justify-center space-y-6">
      <div class="text-center">
        <h3 class="mb-4 text-2xl font-bold text-white">Spiraling Costs</h3>
        <p class="text-lg font-medium text-red-400">The Silent Budget Killer</p>
      </div>

      <div class="space-y-4 text-white">
        <p class="text-base leading-relaxed">
          Cloud costs that spiral out of control can turn innovation into a
          financial nightmare. Without proper governance, spending grows faster
          than value delivery:
        </p>

        <ul class="space-y-2 text-sm">
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Untracked resource provisioning</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Over-provisioned environments</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Lack of automated cost optimization</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Poor visibility into cost drivers</span>
          </li>
        </ul>

        <p class="text-sm leading-relaxed text-gray-300">
          Effective cost management requires real-time monitoring, automated
          rightsizing, and clear accountability across teams.
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
