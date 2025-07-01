// Platform limitations visualization component showing infrastructure constraints
// Displays an animated Google search interface showing common platform limitation queries

import { clsx } from "clsx";
import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  For,
  Show,
  type Component,
} from "solid-js";

import { FlippableCard } from "./FlippableCard";

// ================================================================================================
// GLOBAL STATE STORE
// ================================================================================================

// Create a simple global store for animation state
const createAnimationStore = () => {
  const [state, setState] = createSignal({
    currentPlatformIndex: 0,
    searchText: "",
    showSuggestions: false,
    showClearIcon: false,
    isAnimating: false,
    isPaused: false,
    charIndex: 0,
  });

  return {
    get: state,
    set: setState,
  };
};

// Single instance of the store
const animationStore = createAnimationStore();

// Global timer references to ensure only one set of timers exists
let globalTypingTimeoutId: number | undefined;
let globalSuggestionTimeoutId: number | undefined;
let globalTransitionTimeoutId: number | undefined;

// Clear all global timers
const clearGlobalTimeouts = () => {
  if (globalTypingTimeoutId) {
    window.clearTimeout(globalTypingTimeoutId);
    globalTypingTimeoutId = undefined;
  }
  if (globalSuggestionTimeoutId) {
    window.clearTimeout(globalSuggestionTimeoutId);
    globalSuggestionTimeoutId = undefined;
  }
  if (globalTransitionTimeoutId) {
    window.clearTimeout(globalTransitionTimeoutId);
    globalTransitionTimeoutId = undefined;
  }
};

// ================================================================================================
// COMPONENT PROPS INTERFACE
// ================================================================================================

interface IPlatformLimitationsProps {
  isVisible?: boolean;
}

// ================================================================================================
// DATA CONFIGURATION CONSTANTS
// ================================================================================================

// Platform search data with queries and suggestions
interface IPlatformSearchData {
  platform: string;
  query: string;
  suggestions: string[];
}

const BASE_QUERY = "Why can't ";

const PLATFORM_SEARCH_DATA: IPlatformSearchData[] = [
  {
    platform: "ECS",
    query: "Why can't ECS",
    suggestions: [
      " scale beyond task limits",
      " update tasks without downtime",
      " use spot instances reliably",
      " deploy quickly",
      " monitor container health",
      " integrate with CI/CD",
    ],
  },
  {
    platform: "Lambda",
    query: "Why can't Lambda",
    suggestions: [
      " cold start faster",
      " run longer than 15 minutes",
      " handle large payloads",
      " connect to VPC quickly",
      " debug locally",
      " scale predictably",
    ],
  },
  {
    platform: "Heroku",
    query: "Why can't Heroku",
    suggestions: [
      " use vector databases",
      " achieve enterprise compliance",
      " use custom runtimes",
      " implement zero-trust networking",
      " store large files efficiently",
      " run background jobs reliably",
    ],
  },
  {
    platform: "Vercel",
    query: "Why can't Vercel",
    suggestions: [
      " run long processes",
      " use persistent connections",
      " implement connection draining",
      " customize build process",
      " autoscale databases",
      " implement websockets",
    ],
  },
];

// Validate that all queries start with "Why can't "
// This validation is commented out for production
// PLATFORM_SEARCH_DATA.forEach((data) => {
//   if (!data.query.startsWith(BASE_QUERY)) {
//     console.error(`Query for ${data.platform} must start with "${BASE_QUERY}"`);
//   }
// });

// Animation timing configuration
const GOOGLE_ANIMATION_CONFIG = {
  // Typing animation
  TYPING_SPEED_MIN: 20, // Minimum milliseconds between characters (2x faster)
  TYPING_SPEED_MAX: 50, // Maximum milliseconds between characters (2x faster)
  INITIAL_DELAY: 100, // Delay before starting to type

  // Suggestions animation
  SUGGESTIONS_DELAY: 20, // Delay after typing before showing suggestions (reduced)
  SUGGESTION_STAGGER: 50, // Delay between each suggestion appearing
  SUGGESTION_FADE_DURATION: 200, // Fade in duration for each suggestion

  // Transition between searches
  DISPLAY_DURATION: 2500, // How long to show completed search before transitioning
  CLEAR_ANIMATION_DURATION: 300, // Duration of clearing animation
  BETWEEN_SEARCHES_DELAY: 50, // Delay between searches
  BACKSPACE_SPEED: 25, // Speed of backspace animation when switching questions
};

export const PlatformLimitations: Component<IPlatformLimitationsProps> = (
  props,
) => {
  // Use global store for animation state
  const state = animationStore.get;
  const setState = animationStore.set;

  // Track if this component was mounted (first render)
  let hasInitialized = false;

  // Create getters and setters that work with the store
  const currentPlatformIndex = () => state().currentPlatformIndex;
  const setCurrentPlatformIndex = (
    value: number | ((prev: number) => number),
  ) => {
    setState((prev) => ({
      ...prev,
      currentPlatformIndex:
        typeof value === "function" ? value(prev.currentPlatformIndex) : value,
    }));
  };

  const searchText = () => state().searchText;
  const setSearchText = (value: string) => {
    setState((prev) => ({ ...prev, searchText: value }));
  };

  const showSuggestions = () => state().showSuggestions;
  const setShowSuggestions = (value: boolean) => {
    setState((prev) => ({ ...prev, showSuggestions: value }));
  };

  const showClearIcon = () => state().showClearIcon;
  const setShowClearIcon = (value: boolean) => {
    setState((prev) => ({ ...prev, showClearIcon: value }));
  };

  const isAnimating = () => state().isAnimating;
  const setIsAnimating = (value: boolean) => {
    setState((prev) => ({ ...prev, isAnimating: value }));
  };

  // const isPaused = () => state().isPaused;
  const setIsPaused = (value: boolean) => {
    setState((prev) => ({ ...prev, isPaused: value }));
  };

  const charIndex = () => state().charIndex;
  const setCharIndex = (value: number) => {
    setState((prev) => ({ ...prev, charIndex: value }));
  };

  // Get current platform data
  const getCurrentPlatformData = () => {
    return PLATFORM_SEARCH_DATA[currentPlatformIndex()];
  };

  // Get current platform query
  const getCurrentQuery = () => {
    return getCurrentPlatformData().query;
  };

  // Get current platform name
  // const getCurrentPlatform = () => {
  //   return getCurrentPlatformData().platform;
  // };

  // Get current suggestions
  const getCurrentSuggestions = () => {
    return getCurrentPlatformData().suggestions;
  };

  // Get random typing speed for natural effect (sub-goal 3.2)
  const getRandomTypingSpeed = () => {
    return (
      Math.random() *
        (GOOGLE_ANIMATION_CONFIG.TYPING_SPEED_MAX -
          GOOGLE_ANIMATION_CONFIG.TYPING_SPEED_MIN) +
      GOOGLE_ANIMATION_CONFIG.TYPING_SPEED_MIN
    );
  };

  // Type next character
  const typeNextCharacter = () => {
    const query = getCurrentQuery();
    const currentCharIndex = charIndex();

    // If we haven't typed the full query yet
    if (currentCharIndex < query.length) {
      // If we're resuming and already have base query, adjust the index
      const effectiveIndex =
        searchText() === BASE_QUERY ? BASE_QUERY.length : currentCharIndex;

      setSearchText(query.substring(0, effectiveIndex + 1));
      setShowClearIcon(true); // Show clear icon when text exists (sub-goal 3.3)
      setCharIndex(effectiveIndex + 1);

      // Schedule next character with variable speed
      clearGlobalTimeouts(); // Clear any existing timers
      globalTypingTimeoutId = window.setTimeout(() => {
        typeNextCharacter();
      }, getRandomTypingSpeed());
    } else {
      // Typing complete, show suggestions after delay (sub-goal 5.2)
      clearGlobalTimeouts(); // Clear any existing timers
      globalSuggestionTimeoutId = window.setTimeout(() => {
        setShowSuggestions(true);
        // Schedule transition to next platform after suggestions are shown (sub-goal 5.3)
        scheduleNextTransition();
      }, GOOGLE_ANIMATION_CONFIG.SUGGESTIONS_DELAY);
    }
  };

  // Start typing animation
  const startTypingAnimation = () => {
    // Clear any existing timers first
    clearGlobalTimeouts();

    const currentText = searchText();

    // Reset state but keep base query if present
    if (currentText === BASE_QUERY) {
      // Keep the base query and start typing from there
      setCharIndex(BASE_QUERY.length);
      setShowSuggestions(false);
      setIsAnimating(true);
    } else {
      // Full reset
      setCharIndex(0);
      setSearchText("");
      setShowSuggestions(false);
      setShowClearIcon(false);
      setIsAnimating(true);
    }

    // Start typing after initial delay
    globalTypingTimeoutId = window.setTimeout(() => {
      typeNextCharacter();
    }, GOOGLE_ANIMATION_CONFIG.INITIAL_DELAY);
  };

  // Backspace animation to clear text
  const backspaceText = (callback: () => void) => {
    const currentText = searchText();

    // Only delete if we have more than the base query
    if (currentText.length > BASE_QUERY.length) {
      setSearchText(currentText.slice(0, -1));
      globalTypingTimeoutId = window.setTimeout(() => {
        backspaceText(callback);
      }, GOOGLE_ANIMATION_CONFIG.BACKSPACE_SPEED);
    } else {
      // We've deleted the platform name, now we can proceed
      callback();
    }
  };

  // Move to next platform search (sub-goal 5.1)
  const moveToNextPlatform = () => {
    // Animate backspace to clear current text (keep suggestions visible)
    window.setTimeout(() => {
      backspaceText(() => {
        // Hide suggestions only after all text is cleared
        setShowSuggestions(false);

        // Move to next platform with cycling
        setCurrentPlatformIndex(
          (prev) => (prev + 1) % PLATFORM_SEARCH_DATA.length,
        );

        // Start new animation after delay
        globalTransitionTimeoutId = window.setTimeout(() => {
          startTypingAnimation();
        }, GOOGLE_ANIMATION_CONFIG.BETWEEN_SEARCHES_DELAY);
      });
    }, GOOGLE_ANIMATION_CONFIG.CLEAR_ANIMATION_DURATION);
  };

  // Schedule next platform transition
  const scheduleNextTransition = () => {
    globalTransitionTimeoutId = window.setTimeout(() => {
      moveToNextPlatform();
    }, GOOGLE_ANIMATION_CONFIG.DISPLAY_DURATION);
  };

  // Clear all timeouts (now just calls the global function)
  const clearAllTimeouts = () => {
    clearGlobalTimeouts();
  };

  // Pause animation
  const pauseAnimation = () => {
    clearAllTimeouts();
    setIsPaused(true);
  };

  // Resume animation
  const resumeAnimation = () => {
    // Always clear existing timers first to prevent conflicts
    clearAllTimeouts();
    setIsPaused(false);

    if (!isAnimating()) {
      // No animation started yet, start fresh
      startTypingAnimation();
    } else {
      // Animation was in progress, resume based on current state
      const currentText = searchText();

      if (currentText.length === 0 || currentText === BASE_QUERY) {
        // Text was cleared or only has base query, start typing the platform name
        if (currentText.length === 0) {
          setCharIndex(0);
        } else {
          setCharIndex(BASE_QUERY.length);
        }
        globalTypingTimeoutId = window.setTimeout(() => {
          typeNextCharacter();
        }, GOOGLE_ANIMATION_CONFIG.INITIAL_DELAY);
      } else if (currentText.length < getCurrentQuery().length) {
        // Still typing
        globalTypingTimeoutId = window.setTimeout(() => {
          typeNextCharacter();
        }, getRandomTypingSpeed());
      } else if (!showSuggestions()) {
        // Finished typing but suggestions not shown
        globalSuggestionTimeoutId = window.setTimeout(() => {
          setShowSuggestions(true);
          scheduleNextTransition();
        }, GOOGLE_ANIMATION_CONFIG.SUGGESTIONS_DELAY);
      } else {
        // Suggestions shown, schedule next transition
        scheduleNextTransition();
      }
    }
  };

  // Clean up on unmount
  onCleanup(() => {
    clearAllTimeouts();
  });

  // Initialize animation on mount
  onMount(() => {
    if (!hasInitialized) {
      hasInitialized = true;
      // Small delay to ensure DOM is ready
      window.setTimeout(() => {
        resumeAnimation();
      }, 100);
    }
  });

  // Handle visibility changes for card flipping
  createEffect(() => {
    // Skip the first run to avoid conflict with onMount
    if (hasInitialized) {
      if (props.isVisible) {
        window.setTimeout(() => {
          resumeAnimation();
        }, 50);
      } else {
        pauseAnimation();
      }
    }
  });

  const frontContent = (
    <div
      class={`
        relative flex h-full w-full flex-col items-center bg-gray-dark-mode-900
        p-6 pt-12
      `}
      role="img"
      aria-label="Google search animation showing common platform limitation queries"
      style={{
        "font-family": "arial, sans-serif",
      }}
    >
      {/* Screen reader content */}
      <div class="sr-only">
        <h3>Platform Limitations Search</h3>
        <p>Animated Google search showing common platform limitation queries</p>
      </div>

      {/* Animation styles */}
      <style>
        {`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      {/* Google Logo */}
      <div class="mb-6">
        <svg
          width="272"
          height="92"
          viewBox="0 0 272 92"
          class="h-14 w-auto"
          aria-label="Google"
        >
          <path
            d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44zm57.74 0c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44zm55.74-20.84v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36zM225 3v65h-9.5V3h9.5zm37.02 51.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93zM35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
            fill="#FFF"
          />
        </svg>
      </div>

      {/* Search Box Container */}
      <div class="w-full max-w-2xl">
        <div class="relative">
          {/* Search Box */}
          <div
            class={clsx(
              "flex h-12 items-center border border-gray-dark-mode-600",
              "bg-gray-dark-mode-800 px-4 shadow-lg",
              `
                transition-all duration-200
                hover:shadow-xl
              `,
              showSuggestions() ? "rounded-t-3xl" : "rounded-full",
            )}
          >
            {/* Search Icon */}
            <svg
              class="mr-3 h-5 w-5 text-gray-dark-mode-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            {/* Search Input */}
            <input
              type="text"
              class={`
                flex-1 bg-transparent text-white placeholder-gray-dark-mode-400
                outline-none
              `}
              placeholder="Search Google or type a URL"
              value={searchText()}
              readonly
            />

            {/* Clear Icon */}
            <svg
              class={clsx(
                `
                  mx-3 h-5 w-5 cursor-pointer text-gray-dark-mode-400
                  transition-opacity duration-200
                `,
                showClearIcon() ? "opacity-100" : "opacity-0",
              )}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            {/* Voice Icon */}
            <svg class="h-6 w-6 cursor-pointer" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                fill="#4285F4"
              />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2"
                stroke="#4285F4"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 19v4m-4 0h8"
                stroke="#4285F4"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            {/* Camera Icon */}
            <svg
              class="ml-2 h-6 w-6 cursor-pointer"
              viewBox="0 0 24 24"
              fill="none"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" fill="#FFC107" />
              <circle cx="12" cy="12" r="3" fill="#FF5722" />
              <path d="M3 8h18" stroke="#4CAF50" stroke-width="2" />
              <path d="M8 3v5" stroke="#2196F3" stroke-width="2" />
            </svg>
          </div>

          {/* Search Suggestions (Hidden initially) */}
          <div
            class={clsx(
              "absolute top-full right-0 left-0 mt-0",
              "rounded-b-3xl border border-gray-dark-mode-600",
              "bg-gray-dark-mode-800 shadow-xl",
              "transition-all duration-200",
              showSuggestions() ? "visible opacity-100" : "invisible opacity-0",
            )}
            style={{
              "border-top": showSuggestions()
                ? "1px solid rgb(75 85 99)"
                : "none",
            }}
          >
            <Show when={showSuggestions()}>
              <div class="py-2">
                <For each={getCurrentSuggestions()}>
                  {(suggestion, index) => (
                    <div
                      class={clsx(
                        `
                          flex items-center px-4 py-2
                          hover:bg-gray-dark-mode-700
                        `,
                        "cursor-default transition-all duration-200",
                        "translate-y-2 opacity-0",
                      )}
                      style={{
                        "animation-delay": `${index() * GOOGLE_ANIMATION_CONFIG.SUGGESTION_STAGGER}ms`,
                        animation: showSuggestions()
                          ? `fadeInUp ${GOOGLE_ANIMATION_CONFIG.SUGGESTION_FADE_DURATION}ms ease-out forwards`
                          : "none",
                      }}
                    >
                      {/* Search Icon */}
                      <svg
                        class={`
                          mr-3 h-4 w-4 flex-shrink-0 text-gray-dark-mode-400
                        `}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>

                      {/* Suggestion Text */}
                      <span class="text-sm text-white">
                        <span class="text-gray-dark-mode-300">
                          {getCurrentQuery()}
                        </span>
                        <span class="font-semibold">{suggestion}</span>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Search Buttons */}
      <div class="mt-6 flex gap-3">
        <button
          class={clsx(
            "rounded-md px-4 py-2",
            "bg-gray-dark-mode-700 text-gray-dark-mode-200",
            "border border-gray-dark-mode-700",
            "hover:border-gray-dark-mode-600",
            "transition-colors duration-200",
          )}
        >
          Google Search
        </button>
        <button
          class={clsx(
            "rounded-md px-4 py-2",
            "bg-gray-dark-mode-700 text-gray-dark-mode-200",
            "border border-gray-dark-mode-700",
            "hover:border-gray-dark-mode-600",
            "transition-colors duration-200",
          )}
        >
          I'm Feeling Lucky
        </button>
      </div>
    </div>
  );

  const backContent = (
    <div class="flex h-full w-full flex-col justify-center space-y-6">
      <div class="text-center">
        <h3 class="mb-4 text-2xl font-bold text-white">Platform Limitations</h3>
        <p class="text-lg font-medium text-red-400">Scaling Roadblocks</p>
      </div>

      <div class="space-y-4 text-white">
        <p class="text-base leading-relaxed">
          Resource constraints become business constraints. When platforms can't
          scale, growth stalls. Common limitations include:
        </p>

        <ul class="space-y-2 text-sm">
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Infrastructure capacity ceilings</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Manual provisioning bottlenecks</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Rigid resource allocation policies</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="font-bold text-red-400">•</span>
            <span>Lack of auto-scaling capabilities</span>
          </li>
        </ul>

        <p class="text-sm leading-relaxed text-gray-300">
          Modern platforms need elastic scaling, automated resource management,
          and capacity planning to support business growth without technical
          debt.
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
