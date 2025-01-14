import { scrollYStore } from "@/stores/documentation-store.ts";

const eventHandlers = new WeakMap<HTMLElement, EventListener>();

let scroller: HTMLElement | null = null;

export function addScrollListener() {
  scroller = document.querySelector(".scrollbar") as HTMLElement | null;

  const scrollHandler = () => {
    scrollYStore.set(scroller?.scrollTop);
  };

  if (scroller && !eventHandlers.has(scroller)) {
    scroller.addEventListener("scroll", scrollHandler);

    eventHandlers.set(scroller, scrollHandler);
  }
}

export function goToScrollPosition() {
  if (scroller) {
    scroller.scrollTo(0, scrollYStore.get());
  }
}
