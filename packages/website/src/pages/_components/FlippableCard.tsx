// Reusable flippable card component with 3D flip animation
// Accepts front and back content and handles flip state management

import { clsx } from "clsx";
import { createSignal, type Component, type JSX } from "solid-js";

import styles from "./FlippableCard.module.css";

// ================================================================================================
// COMPONENT PROPS INTERFACE
// ================================================================================================

interface IFlippableCardProps {
  frontContent: JSX.Element;
  backContent: JSX.Element;
  isVisible?: boolean;
  onFlipChange?: (isFlipped: boolean) => void;
}

export const FlippableCard: Component<IFlippableCardProps> = (props) => {
  const [isFlipped, setIsFlipped] = createSignal(false);
  const [showHint, setShowHint] = createSignal(true);
  const [isHovering, setIsHovering] = createSignal(false);
  const [isRetracting, setIsRetracting] = createSignal(false);
  const [canExtend, setCanExtend] = createSignal(true);

  const handleCardClick = () => {
    const newFlipState = !isFlipped();

    if (!isFlipped()) {
      // When flipping to back, retract hint first
      setIsRetracting(true);
      setCanExtend(false);
      // Start flipping immediately
      setIsFlipped(newFlipState);
      props.onFlipChange?.(newFlipState);
      // Hide hint after retraction animation
      setTimeout(() => {
        setShowHint(false);
        setIsRetracting(false);
      }, 300);
    } else {
      // When flipping to front
      setIsFlipped(newFlipState);
      props.onFlipChange?.(newFlipState);
      // Show hint after flip completes
      setTimeout(() => {
        setShowHint(true);
        // Allow extension after a brief delay
        setTimeout(() => {
          setCanExtend(true);
        }, 50);
      }, 800);
    }
  };

  return (
    <div
      class="group relative h-full w-full cursor-pointer"
      style={{
        perspective: "1500px",
        "perspective-origin": "center center",
        overflow: "visible",
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role="button"
      tabIndex={0}
      aria-label={
        isFlipped() ? "Click to show visualization" : "Click to show details"
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Click to flip hint - slides from behind card */}
      {showHint() && (
        <div
          class={clsx(
            "absolute bottom-0 left-1/2 -z-10 -translate-x-1/2",
            "rounded-b-lg px-4 py-2",
            "bg-gray-dark-mode-700/90 backdrop-blur-sm",
            "border border-t-0 border-gray-dark-mode-600/50",
            "text-sm font-medium text-white/90",
            "transition-transform duration-300 ease-out",
            "-translate-y-[5px]",
            // Show when hovering and not flipped, not retracting, and can extend
            isHovering() &&
              !isFlipped() &&
              !isRetracting() &&
              canExtend() &&
              "translate-y-full",
          )}
        >
          Click to flip
        </div>
      )}

      <div class={clsx(styles.flipContainer, isFlipped() && styles.flipped)}>
        {/* Front Side */}
        <div
          class={clsx(
            "overflow-hidden transition-all duration-300",
            "group-hover:scale-[1.02]",
            "relative z-10",
            styles.cardSide,
            styles.frontSide,
          )}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
            "backdrop-filter": "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div
            class="h-full w-full rounded-2xl"
            style={{ overflow: "visible" }}
          >
            {props.frontContent}
          </div>
        </div>

        {/* Back Side */}
        <div
          class={clsx(
            "transition-all duration-300",
            "group-hover:scale-[1.02]",
            "relative z-10",
            styles.cardSide,
            styles.backSide,
          )}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
            "backdrop-filter": "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div class="relative flex h-full w-full flex-col p-6">
            {props.backContent}
          </div>
        </div>
      </div>
    </div>
  );
};
