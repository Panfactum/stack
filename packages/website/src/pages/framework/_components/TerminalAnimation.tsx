// Terminal animation component with character-by-character typing
// Includes blinking cursor and copy-to-clipboard functionality
import { toaster } from "@kobalte/core/toast";
import { clsx } from "clsx";
import { HiOutlineClipboard, HiOutlineCheck } from "solid-icons/hi";
import {
  type Component,
  createSignal,
  createEffect,
  onCleanup,
  Show,
} from "solid-js";

import Toast from "@/components/ui/Toast";

import styles from "./TerminalAnimation.module.css";

const COMMAND = "curl -sSL https://install.panfactum.com/edge.sh | sh";
const TYPING_SPEED = 25; // milliseconds per character
// Calculate width: ~8.5px per character + padding + icon space + gap
const CONTAINER_WIDTH = COMMAND.length * 8.5 + 80; // 80px for padding, icon, and gaps

interface TerminalAnimationProps {
  startTyping?: boolean;
}

export const TerminalAnimation: Component<TerminalAnimationProps> = (props) => {
  const [displayedText, setDisplayedText] = createSignal("");
  const [isComplete, setIsComplete] = createSignal(false);
  const [isCopied, setIsCopied] = createSignal(false);

  // Typing animation
  createEffect(() => {
    if (!props.startTyping) return;

    let index = 0;

    const interval = setInterval(() => {
      if (index <= COMMAND.length) {
        setDisplayedText(COMMAND.slice(0, index));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, TYPING_SPEED);

    onCleanup(() => {
      clearInterval(interval);
    });
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setIsCopied(true);

      // Show toast
      const toastID = toaster.show((props) => (
        <Toast id={props.toastId} title="Command copied to clipboard" />
      ));

      // Reset after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
        toaster.dismiss(toastID);
      }, 2000);
    } catch (err) {
      // Failed to copy to clipboard
    }
  };

  return (
    <div
      id="terminal-animation"
      class={`
        inline-flex min-h-[40px] items-center gap-2 rounded-lg
        bg-gray-dark-mode-900 px-4 py-2 font-mono text-sm
      `}
      style={{ width: `${CONTAINER_WIDTH}px` }}
    >
      <span class="text-green-400">$</span>
      <span class="text-gray-dark-mode-50">
        {displayedText()}
        <Show when={!isComplete()}>
          <span
            class={clsx(
              "inline-block h-4 w-2 bg-gray-dark-mode-50",
              styles.cursor,
            )}
          />
        </Show>
      </span>
      <Show when={isComplete()}>
        <button
          onClick={() => void handleCopy()}
          class={clsx(
            "relative rounded p-1 transition-colors",
            isCopied()
              ? "text-green-400"
              : `
                text-gray-dark-mode-400
                hover:text-gray-dark-mode-50
              `,
          )}
          aria-label="Copy command to clipboard"
        >
          <Show
            when={!isCopied()}
            fallback={<HiOutlineCheck class="h-4 w-4" />}
          >
            <HiOutlineClipboard class="h-4 w-4" />
          </Show>
        </button>
      </Show>
    </div>
  );
};
