// Scroll behavior component to handle header visibility
import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  type Component,
} from "solid-js";

export const ScrollBehavior: Component = () => {
  const [lastScrollY, setLastScrollY] = createSignal(0);
  const [isHeaderHidden, setIsHeaderHidden] = createSignal(false);

  const handleScroll = () => {
    // Check if window is available (client-side only)
    if (typeof window === "undefined") return;

    const currentScrollY = window.scrollY;
    const scrollThreshold = 100; // Start hiding after 100px scroll

    // Only apply scroll behavior if we have scrolled past threshold
    if (currentScrollY < scrollThreshold) {
      setIsHeaderHidden(false);
    } else {
      // Hide header when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY() && currentScrollY > scrollThreshold) {
        setIsHeaderHidden(true);
      } else if (currentScrollY < lastScrollY()) {
        setIsHeaderHidden(false);
      }
    }

    setLastScrollY(currentScrollY);
  };

  onMount(() => {
    // Check if window is available (client-side only)
    if (typeof window === "undefined") return;

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Apply initial styles
    const primaryHeader = document.querySelector(
      "[data-primary-header]",
    ) as HTMLElement;
    const secondTierNav = document.querySelector(
      "[data-second-tier-nav]",
    ) as HTMLElement;

    primaryHeader.style.setProperty("transition", "transform 0.3s ease-in-out");
    secondTierNav.style.setProperty(
      "transition",
      "transform 0.3s ease-in-out, top 0.3s ease-in-out",
    );
  });

  onCleanup(() => {
    // Check if window is available (client-side only)
    if (typeof window !== "undefined") {
      window.removeEventListener("scroll", handleScroll);
    }
  });

  // Apply transform styles based on scroll state
  createEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === "undefined") return;

    const primaryHeader = document.querySelector(
      "[data-primary-header]",
    ) as HTMLElement;
    const secondTierNav = document.querySelector(
      "[data-second-tier-nav]",
    ) as HTMLElement;

    if (isHeaderHidden()) {
      primaryHeader.style.setProperty("transform", "translateY(-100%)");
      // Move second tier to top when primary header is hidden
      secondTierNav.style.setProperty("top", "0");
      secondTierNav.style.setProperty("transform", "translateY(0)");
    } else {
      primaryHeader.style.setProperty("transform", "translateY(0)");
      // Position second tier below primary header
      secondTierNav.style.setProperty("top", "var(--header-height)");
      secondTierNav.style.setProperty("transform", "translateY(0)");
    }
  });

  return null;
};
