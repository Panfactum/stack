// Scale section component with animated tab progression for company growth stages
// Features horizontal tabs with auto-progression, fill animation, and slide-in content transitions
import { createVisibilityObserver } from "@solid-primitives/intersection-observer";
import { Image } from "@unpic/solid";
import { clsx } from "clsx";
import {
  TbOutlineRocket,
  TbOutlineTrendingUp,
  TbOutlineChartLine,
  TbOutlineUsers,
  TbOutlineBuilding,
} from "solid-icons/tb";
import {
  createSignal,
  onMount,
  onCleanup,
  For,
  type Component,
} from "solid-js";

import styles from "./ScaleSection.module.css";
import bootstrappedTeamImage from "./images/bootstrapped-team.png";
import seedTeamImage from "./images/seed-team.png";
import seriesATeamImage from "./images/series-a-team.png";
import seriesBTeamImage from "./images/series-b-team.png";
import seriesCTeamImage from "./images/series-c-team.png";

// Animation timing constants
const FILL_DURATION = 8000; // 8 seconds as specified
const FILL_UPDATE_INTERVAL = 50;
const VISIBILITY_THRESHOLD = 0.3;
const VISIBILITY_ROOT_MARGIN = "0px 0px -100px 0px";

// Tab content data structure
interface TabContent {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  icon: Component<{ size?: number; class?: string }>;
  content: string;
  image: string;
  roles: string[];
  companyName: string;
  logoColor: string;
}

// Component interface
interface IScaleSectionProps {
  className?: string;
}

export const ScaleSection: Component<IScaleSectionProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal(0);
  const [fillProgress, setFillProgress] = createSignal(0);
  const [isAutoProgressing, setIsAutoProgressing] = createSignal(true);
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [immediateTransition, setImmediateTransition] = createSignal(false);
  let intervalRef: ReturnType<typeof setInterval>;
  let sectionRef: HTMLDivElement | undefined;

  // Tab content data
  const tabs: TabContent[] = [
    {
      id: "bootstrapped",
      name: "Bootstrapped",
      title: "Bootstrapped",
      subtitle:
        "Get to launch day with real infrastructure—no cloud headaches.",
      icon: TbOutlineRocket,
      content:
        "When every dollar matters and every hour counts, we give you a fully production-ready platform out-of-the-box—backed by expert help, automated tooling, and zero fluff. Focus on building your product, we'll manage the infrastructure.",
      image: bootstrappedTeamImage.src,
      roles: ["Founder"],
      companyName: "Nexflow",
      logoColor: "bg-purple-500",
    },
    {
      id: "seed",
      name: "Seed",
      title: "Seed",
      subtitle: "Move fast, stay lean, and impress your first customers.",
      icon: TbOutlineTrendingUp,
      content:
        "You need reliability without bloated overhead. We give you managed Kubernetes, autoscaling, cost optimization, and a dedicated engineer so that you can onboard users confidently without worrying about downtime or DevOps hiring.",
      image: seedTeamImage.src,
      roles: ["CTO", "Lead Engineer"],
      companyName: "DataPulse",
      logoColor: "bg-blue-500",
    },
    {
      id: "series-a",
      name: "Series A",
      title: "Series A",
      subtitle: "Ready for growth, built to scale.",
      icon: TbOutlineChartLine,
      content:
        "The flywheel is turning and nothing is more important than maintaining your momentum. We help you shed the limits of your MVP systems without disruption by installing compliance-friendly defaults, multi-env deployments, and proactive monitoring.",
      image: seriesATeamImage.src,
      roles: ["VP Engineering", "Platform Engineer", "DevOps Lead"],
      companyName: "Streamify",
      logoColor: "bg-green-500",
    },
    {
      id: "series-b",
      name: "Series B",
      title: "Series B",
      subtitle:
        "Free your engineers to focus on what makes your product great.",
      icon: TbOutlineUsers,
      content:
        "You've outgrown homegrown infrastructure. Panfactum takes full ownership of upgrades, environment parity, and incident triage—so your platform team can invest in performance, reliability, and customer-facing improvements.",
      image: seriesBTeamImage.src,
      roles: ["CTO", "VP Engineering", "Staff Engineer"],
      companyName: "CloudVault",
      logoColor: "bg-orange-500",
    },
    {
      id: "series-c-plus",
      name: "Series C+",
      title: "Series C+",
      subtitle:
        "Enterprise-grade infrastructure. Without the enterprise-grade bloat.",
      icon: TbOutlineBuilding,
      content:
        "As your company scales, so does the complexity. We deliver enterprise-grade reliability—global scale, multi-team collaboration, fine-grained cost controls—all while maintaining the same velocity that helped you reach your current success.",
      image: seriesCTeamImage.src,
      roles: ["Engineering Director", "Principal Engineer", "SRE Manager"],
      companyName: "TechForge",
      logoColor: "bg-red-500",
    },
  ];

  // Handle tab click
  const handleTabClick = (index: number) => {
    if (index === activeTab()) return;

    setIsAutoProgressing(false);
    setImmediateTransition(true);
    setIsTransitioning(true);

    // Immediate switch for manual selection
    requestAnimationFrame(() => {
      setActiveTab(index);
      setFillProgress(0);
      requestAnimationFrame(() => {
        setIsTransitioning(false);
        setImmediateTransition(false);
      });
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: KeyboardEvent, currentIndex: number) => {
    let newIndex = currentIndex;

    switch (event.key) {
      case "ArrowLeft": {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        handleTabClick(newIndex);
        // Focus the new tab
        const prevButton = document.querySelector(
          `[data-tab-index="${newIndex}"]`,
        ) as HTMLButtonElement;
        prevButton.focus();
        break;
      }
      case "ArrowRight": {
        event.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        handleTabClick(newIndex);
        // Focus the new tab
        const nextButton = document.querySelector(
          `[data-tab-index="${newIndex}"]`,
        ) as HTMLButtonElement;
        nextButton.focus();
        break;
      }
      case "Home": {
        event.preventDefault();
        handleTabClick(0);
        const firstButton = document.querySelector(
          `[data-tab-index="0"]`,
        ) as HTMLButtonElement;
        firstButton.focus();
        break;
      }
      case "End": {
        event.preventDefault();
        handleTabClick(tabs.length - 1);
        const lastButton = document.querySelector(
          `[data-tab-index="${tabs.length - 1}"]`,
        ) as HTMLButtonElement;
        lastButton.focus();
        break;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        handleTabClick(currentIndex);
        break;
    }
  };

  // Reset auto-progression when section becomes visible
  const resetAutoProgression = () => {
    setIsAutoProgressing(true);
    setFillProgress(0);
  };

  // Set up auto-progression
  onMount(() => {
    const incrementPerUpdate = 100 / (FILL_DURATION / FILL_UPDATE_INTERVAL);

    // Auto-progression interval
    intervalRef = setInterval(() => {
      if (!isAutoProgressing() || isPaused() || isTransitioning()) return;

      setFillProgress((prev) => {
        const newProgress = prev + incrementPerUpdate;

        if (newProgress >= 100) {
          // Pause briefly at 100% before transitioning
          setIsPaused(true);

          setTimeout(() => {
            // Start transition
            setIsTransitioning(true);

            // Move to next tab and reset after fade completes
            setTimeout(() => {
              setActiveTab((prev) => (prev + 1) % tabs.length);
              setFillProgress(0);
              setIsTransitioning(false);
              setIsPaused(false);
            }, 250); // Allow time for fade transition
          }, 200);

          return 100;
        }

        return newProgress;
      });
    }, FILL_UPDATE_INTERVAL);

    // Set up visibility observer to pause/resume when section leaves viewport
    const useVisibilityObserver = createVisibilityObserver(
      {
        threshold: VISIBILITY_THRESHOLD,
        rootMargin: VISIBILITY_ROOT_MARGIN,
      },
      (entry) => {
        if (entry.isIntersecting) {
          // Resume auto-progression when section becomes visible
          if (!isAutoProgressing()) {
            resetAutoProgression();
          }
        } else {
          // Pause when section is not visible
          if (isAutoProgressing()) {
            setIsAutoProgressing(false);
          }
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
    <section
      ref={sectionRef}
      class={clsx(
        `
          mx-auto max-w-screen-2xl px-6 py-20
          md:px-10
          lg:px-16
        `,
        props.className,
      )}
    >
      {/* Section header */}
      <div class="mb-16 text-center">
        <h2 class="mb-6 font-machina text-display-lg font-bold text-white">
          Platform Engineering That Scales
        </h2>
        <p class="mx-auto max-w-4xl text-display-sm text-secondary">
          No matter where your business is on its journey, we can help you take
          back control of your cloud destiny.
        </p>
      </div>

      {/* Tab navigation */}
      <div
        class={`
          mb-6
          md:mb-12
        `}
      >
        {/* Mobile layout with side buttons */}
        <div class="lg:hidden">
          <div class="flex items-center gap-4">
            {/* Left navigation button */}
            <button
              onClick={() => {
                const newIndex =
                  activeTab() > 0 ? activeTab() - 1 : tabs.length - 1;
                handleTabClick(newIndex);
              }}
              class={clsx(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center",
                "rounded-lg border border-gray-dark-mode-600",
                "bg-gray-dark-mode-800 text-white transition-colors",
                "hover:bg-gray-dark-mode-700",
                "focus:outline-none",
              )}
              aria-label="Previous stage"
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

            {/* Current tab display */}
            <div class="relative flex-1 overflow-hidden rounded-lg px-6 py-4">
              {/* Background fill that animates */}
              <div
                class="absolute inset-0"
                style={{
                  "background-color": "var(--color-brand-500)",
                  transform: `translateX(${fillProgress() - 100}%)`,
                  opacity: fillProgress() >= 100 ? 0 : 1,
                  transition: "transform 50ms linear, opacity 200ms ease-out",
                }}
              />
              {/* Text and dots container */}
              <div class="relative z-10 flex items-center justify-between">
                {/* Current tab text */}
                <span class="text-display-xs font-medium text-white">
                  {tabs[activeTab()].name}
                </span>
                {/* Dots indicator */}
                <div class="flex gap-2">
                  <For each={tabs}>
                    {(_, index) => (
                      <button
                        onClick={() => {
                          handleTabClick(index());
                        }}
                        class={clsx(
                          "h-2 w-2 rounded-full transition-colors duration-200",
                          index() === activeTab()
                            ? "bg-white"
                            : `
                              bg-gray-dark-mode-600
                              hover:bg-gray-dark-mode-500
                            `,
                        )}
                        aria-label={`Go to ${tabs[index()].name} stage`}
                      />
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Right navigation button */}
            <button
              onClick={() => {
                const newIndex = (activeTab() + 1) % tabs.length;
                handleTabClick(newIndex);
              }}
              class={clsx(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center",
                "rounded-lg border border-gray-dark-mode-600",
                "bg-gray-dark-mode-800 text-white transition-colors",
                "hover:bg-gray-dark-mode-700",
                "focus:outline-none",
              )}
              aria-label="Next stage"
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

        {/* Desktop layout - horizontal tabs */}
        <div
          class={`
            hidden justify-center
            lg:flex
          `}
        >
          <div
            class={`
              inline-flex w-full max-w-4xl rounded-2xl border
              border-gray-dark-mode-700 bg-gray-dark-mode-800 shadow-2xl
            `}
            role="tablist"
            aria-label="Company growth stage tabs"
          >
            <For each={tabs}>
              {(tab, index) => (
                <button
                  data-tab-index={index()}
                  onClick={() => {
                    handleTabClick(index());
                  }}
                  onKeyDown={(e) => {
                    handleKeyDown(e, index());
                  }}
                  class={clsx(
                    `
                      relative flex-1 overflow-hidden px-6 py-5 text-lg
                      font-semibold tracking-wide
                    `,
                    // Border radius for first and last tabs
                    index() === 0 && "rounded-l-2xl",
                    index() === tabs.length - 1 && "rounded-r-2xl",
                    `
                      transition-all duration-200
                      focus:outline-none
                    `,
                    // Only apply hover background when not the active tab
                    index() !== activeTab() &&
                      `
                        hover:bg-gray-dark-mode-700/50
                        [&>span]:hover:text-gray-200
                      `,
                    // Full blue background when manually selected and not auto-progressing
                    index() === activeTab() &&
                      !isAutoProgressing() &&
                      `[background-color:var(--color-brand-500)]`,
                  )}
                  role="tab"
                  aria-selected={index() === activeTab()}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabindex={index() === activeTab() ? 0 : -1}
                  aria-label={`${tab.name} plan details`}
                >
                  {/* Fill animation background */}
                  <div
                    class="absolute inset-0"
                    style={{
                      "background-color": "var(--color-brand-500)",
                      transform: `translateX(${index() === activeTab() ? fillProgress() - 100 : -100}%)`,
                      opacity:
                        index() === activeTab()
                          ? fillProgress() >= 100
                            ? 0
                            : 1
                          : 0,
                      transition:
                        "transform 50ms linear, opacity 200ms ease-out",
                    }}
                  />

                  {/* Tab text */}
                  <span
                    class={`
                      pointer-events-none relative z-10 transition-colors
                      duration-200 ease-out
                    `}
                    style={{
                      color:
                        index() === activeTab() &&
                        ((fillProgress() > 0 && fillProgress() < 100) ||
                          !isAutoProgressing())
                          ? "white"
                          : "var(--color-gray-400)",
                    }}
                  >
                    {tab.name}
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Content display area */}
      <div
        class={clsx(
          "relative mx-auto max-w-5xl overflow-hidden rounded-2xl",
          immediateTransition() && styles.immediateTransition,
        )}
      >
        <For each={tabs}>
          {(tab, index) => (
            <div
              id={`tabpanel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              tabindex={0}
              class={clsx(
                `
                  grid grid-cols-1 gap-8 p-6
                  md:p-8
                  lg:grid-cols-2 lg:gap-12 lg:p-12
                `,
                styles.tabPanel,
                index() === activeTab()
                  ? styles.tabPanelActive
                  : styles.tabPanelInactive,
                isTransitioning() &&
                  index() === activeTab() &&
                  styles.transitioning,
              )}
            >
              {/* Left column - Content */}
              <div
                class={clsx(
                  `
                    order-2 flex flex-col justify-center
                    lg:order-1
                  `,
                  styles.leftColumn,
                  index() === activeTab() && !isTransitioning()
                    ? styles.leftColumnActive
                    : styles.leftColumnInactive,
                )}
              >
                {/* Title with icon - hidden on mobile */}
                <div
                  class={`
                    mb-4 hidden items-center gap-3
                    md:mb-6 md:flex
                  `}
                >
                  <div
                    class={`
                      flex h-10 w-10 items-center justify-center rounded-lg
                      bg-brand-500/20
                      md:h-12 md:w-12
                    `}
                  >
                    <tab.icon
                      size={20}
                      class={`
                        text-brand-500
                        md:text-[24px]
                      `}
                    />
                  </div>
                  <h3
                    class={`
                      font-machina text-display-sm font-bold text-white
                      md:text-display-md
                    `}
                  >
                    {tab.title}
                  </h3>
                </div>
                {/* Subtitle */}
                <p
                  class={`
                    mb-6 text-lg font-medium text-secondary
                    md:mb-8 md:text-xl
                  `}
                >
                  {tab.subtitle}
                </p>
                <p
                  class={`
                    text-base leading-relaxed text-tertiary
                    md:text-lg
                  `}
                >
                  {tab.content}
                </p>
              </div>

              {/* Right column - Content card with team image */}
              <div
                class={clsx(
                  `
                    order-1 flex flex-col
                    lg:order-2
                  `,
                  styles.rightColumn,
                  index() === activeTab() && !isTransitioning()
                    ? styles.rightColumnActive
                    : styles.rightColumnInactive,
                )}
              >
                {/* Content card */}
                <div
                  class={`
                    relative flex flex-col overflow-hidden rounded-xl bg-none
                  `}
                >
                  {/* Top section: Team image */}
                  <div
                    class={`
                      relative flex h-64 items-center justify-center
                      overflow-hidden bg-none
                      md:h-80
                    `}
                  >
                    <Image
                      src={tab.image}
                      alt={`Team at ${tab.name} stage`}
                      width={400}
                      height={300}
                      class={`h-full w-full rounded-[10px] object-cover`}
                    />
                  </div>

                  {/* Logo pill - positioned at the bottom of the image */}
                  <div
                    class={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2`}
                  >
                    <div
                      class={`
                        flex items-center gap-2 rounded-full border
                        border-gray-dark-mode-700 bg-gray-dark-mode-800 px-4
                        py-2 shadow-lg
                      `}
                    >
                      <div
                        class={clsx(
                          `
                            flex h-5 w-5 items-center justify-center rounded-md
                            md:h-6 md:w-6
                          `,
                          tab.logoColor,
                        )}
                      >
                        {/* Custom logo for each company */}
                        {tab.id === "bootstrapped" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            class={`
                              h-3.5 w-3.5
                              md:h-4 md:w-4
                            `}
                          >
                            <path
                              d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                              stroke="white"
                              stroke-width="2"
                              stroke-linejoin="round"
                            />
                            <path
                              d="M12 8V16M8 10L12 8L16 10"
                              stroke="white"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        )}
                        {tab.id === "seed" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            class={`
                              h-3.5 w-3.5
                              md:h-4 md:w-4
                            `}
                          >
                            <circle cx="12" cy="12" r="3" fill="white" />
                            <path
                              d="M12 2V8M12 16V22M4.93 4.93L8.17 8.17M15.83 15.83L19.07 19.07M2 12H8M16 12H22M4.93 19.07L8.17 15.83M15.83 8.17L19.07 4.93"
                              stroke="white"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                          </svg>
                        )}
                        {tab.id === "series-a" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            class={`
                              h-3.5 w-3.5
                              md:h-4 md:w-4
                            `}
                          >
                            <path
                              d="M4 12C4 12 8 4 12 4C16 4 20 12 20 12C20 12 16 20 12 20C8 20 4 12 4 12Z"
                              fill="white"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              fill="currentColor"
                              class="text-green-600"
                            />
                          </svg>
                        )}
                        {tab.id === "series-b" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            class={`
                              h-3.5 w-3.5
                              md:h-4 md:w-4
                            `}
                          >
                            <rect
                              x="3"
                              y="3"
                              width="7"
                              height="7"
                              fill="white"
                              rx="1"
                            />
                            <rect
                              x="14"
                              y="3"
                              width="7"
                              height="7"
                              fill="white"
                              rx="1"
                            />
                            <rect
                              x="3"
                              y="14"
                              width="7"
                              height="7"
                              fill="white"
                              rx="1"
                            />
                            <rect
                              x="14"
                              y="14"
                              width="7"
                              height="7"
                              fill="white"
                              rx="1"
                            />
                          </svg>
                        )}
                        {tab.id === "series-c-plus" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            class={`
                              h-3.5 w-3.5
                              md:h-4 md:w-4
                            `}
                          >
                            <path
                              d="M12 2L3 7V12C3 16.5 6 20.26 12 22C18 20.26 21 16.5 21 12V7L12 2Z"
                              fill="white"
                            />
                            <path
                              d="M12 7V11M12 11V15M12 11H8M12 11H16"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              class="text-red-700"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        class={`
                          text-xs font-medium text-white
                          md:text-sm
                        `}
                      >
                        {tab.companyName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </section>
  );
};
