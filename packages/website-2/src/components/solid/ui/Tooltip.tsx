import { clsx } from "clsx";
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type ParentComponent,
} from "solid-js";
import { isServer } from "solid-js/web";
import usePopper from "solid-popper";

interface TooltipProps {
  anchor: HTMLElement | undefined;
}

const Tooltip: ParentComponent<TooltipProps> = (props) => {
  const [popperEl, setPopperEl] = createSignal<HTMLElement>();
  const [isOpen, setIsOpen] = createSignal<boolean>(false);
  const [mouseInTooltip, setMouseInTooltip] = createSignal<boolean>(false);
  const [closeInterval, setCloseInterval] =
    createSignal<ReturnType<typeof setInterval>>();

  const popperInstance = usePopper(() => props.anchor, popperEl, {
    placement: "auto",
    strategy: "fixed",
  });

  const openTooltip = (e: Event) => {
    e.stopPropagation();
    setIsOpen(true);
  };
  const closeTooltip = () => {
    setIsOpen(false);
    clearCloseInterval();
  };

  // We delay and debounce the close actions for a smoother
  // user experience
  // Note: This probably needs to be refactored to provide a true
  // delay rather than just a spot check every 200ms.
  const prepareToClose = () => {
    if (!closeInterval()) {
      const interval = setInterval(() => {
        if (!mouseInTooltip()) {
          setIsOpen(false);
          clearCloseInterval();
        }
      }, 200);
      setCloseInterval(interval);
    }
  };
  const clearCloseInterval = () => {
    if (closeInterval()) {
      clearInterval(closeInterval());
      setCloseInterval(undefined);
    }
  };

  // Close the tooltip immediately if the user clicks outside the tooltip
  // Used for mobile (but also useful on desktop)
  const onClickDocument = (e: TouchEvent) => {
    const popperElement = popperEl();
    if (popperElement) {
      const target = e.target;
      if (
        target instanceof Node &&
        popperElement &&
        !popperElement.contains(target)
      ) {
        closeTooltip();
      }
    }
  };

  const onMouseEnteredTooltip = () => setMouseInTooltip(true);
  const onMouseLeaveTooltip = () => setMouseInTooltip(false);

  // If the anchor element is hidden, the popper tooltip is positioned inappropriately when
  // the anchor element becomes unhidden. As a result, when the tooltip opens, we need to update
  // the popper positioning.
  createEffect(() => {
    if (isOpen()) {
      void popperInstance()?.update();
    }
  });

  onMount(() => {
    if (props.anchor) {
      // Toolip should display on hover
      props.anchor.addEventListener("mouseenter", openTooltip);
      props.anchor.addEventListener("mouseleave", prepareToClose);

      // Provides handling for mobile (where touch is used vs hover)
      props.anchor.addEventListener("touchstart", openTooltip);
      if (!isServer) {
        window.document.addEventListener("touchstart", onClickDocument);
      }
    }

    // This ensures that we don't hide tooltip if the user is hovered over the tooltip
    const popperElement = popperEl();
    if (popperElement) {
      popperElement.addEventListener("mouseenter", onMouseEnteredTooltip);
      popperElement.addEventListener("mouseleave", onMouseLeaveTooltip);
    }
  });

  onCleanup(() => {
    if (props.anchor) {
      props.anchor.removeEventListener("mouseenter", openTooltip);
      props.anchor.removeEventListener("mouseleave", prepareToClose);
    }
    const popperElement = popperEl();
    if (popperElement) {
      popperElement.removeEventListener("mouseenter", onMouseEnteredTooltip);
      popperElement.removeEventListener("mouseleave", onMouseLeaveTooltip);
    }
    props.anchor?.removeEventListener("touchstart", openTooltip);
    if (!isServer) {
      window.document.removeEventListener("touchstart", onClickDocument);
    }
    clearCloseInterval();
  });

  return (
    <div
      ref={setPopperEl}
      class={clsx("bg-primary rounded-xl border-2 border-white")}
      style={
        isOpen()
          ? {
              visibility: "visible",
              opacity: 1,
              transition: "opacity 300ms ease-in-out",
            }
          : {
              visibility: "hidden",
              opacity: 0,
              transition: "visibility 0s 300ms, opacity 300ms ease-in-out",
            }
      }
    >
      <div class={"p-4"}>{props.children}</div>
    </div>
  );
};

export default Tooltip;
