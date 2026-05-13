/* eslint-disable better-tailwindcss/no-unknown-classes -- classes defined in global.css */
import { Popover } from "@kobalte/core/popover";
import {
  type Component,
  Show,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { render } from "solid-js/web";

interface ITriggerConfig {
  id: string;
  type: "footnote" | "term";
  mount: HTMLElement;
  html?: string;
  summary?: string;
  title?: string;
  readMoreHref?: string;
  ariaLabel: string;
  triggerText: string;
}

interface IPopoverProps {
  config: ITriggerConfig;
}

// Module-level signals so all render roots share the same active-popover state
const [activeId, setActiveId] = createSignal<string | null>(null);

function decodeBase64(encoded: string): string {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- atob is the correct browser API here
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const FootnotePopover: Component<IPopoverProps> = (props) => {
  const isOpen = () => activeId() === props.config.id;

  function handleOpenChange(open: boolean) {
    setActiveId(open ? props.config.id : null);
  }

  return (
    <Popover
      open={isOpen()}
      onOpenChange={handleOpenChange}
      placement="top"
      flip
      slide
      gutter={8}
      fitViewport
    >
      <Popover.Trigger
        class="footnote-popover-trigger"
        aria-label={props.config.ariaLabel}
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="footnote-popover"
          onOpenAutoFocus={(e: Event) => {
            e.preventDefault();
          }}
        >
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <div innerHTML={props.config.html} />
          <Show when={props.config.readMoreHref}>
            {(href) => (
              <a class="footnote-read-more" href={href()}>
                Read more &rarr;
              </a>
            )}
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

const TermPopover: Component<IPopoverProps> = (props) => {
  const isOpen = () => activeId() === props.config.id;

  function handleOpenChange(open: boolean) {
    setActiveId(open ? props.config.id : null);
  }

  return (
    <Popover
      open={isOpen()}
      onOpenChange={handleOpenChange}
      placement="top"
      flip
      slide
      gutter={8}
      fitViewport
    >
      <Popover.Trigger
        as="span"
        class="term-popover-trigger"
        aria-label={props.config.ariaLabel}
      >
        {props.config.triggerText}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="term-popover"
          onOpenAutoFocus={(e: Event) => {
            e.preventDefault();
          }}
        >
          <Show when={props.config.title}>
            {(title) => <p class="term-popover-title">{title()}</p>}
          </Show>
          <p>{props.config.summary}</p>
          <Show when={props.config.readMoreHref}>
            {(href) => (
              <a class="term-read-more" href={href()}>
                Read more &rarr;
              </a>
            )}
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

const PopoverManager: Component = () => {
  const disposers: (() => void)[] = [];

  onMount(() => {
    // Collect footnote triggers
    const footnoteTriggers = document.querySelectorAll<HTMLElement>(
      ".footnote-popover-trigger",
    );
    footnoteTriggers.forEach((trigger, i) => {
      const encoded = trigger.getAttribute("data-footnote-content");
      if (!encoded) return;

      const config: ITriggerConfig = {
        id: `footnote-${i}`,
        type: "footnote",
        mount: document.createElement("span"),
        html: decodeBase64(encoded),
        readMoreHref:
          trigger.getAttribute("data-footnote-read-more") ?? undefined,
        ariaLabel: trigger.getAttribute("aria-label") ?? `Footnote ${i}`,
        triggerText: "?",
      };

      config.mount.style.display = "inline";
      trigger.replaceWith(config.mount);
      disposers.push(
        render(() => <FootnotePopover config={config} />, config.mount),
      );
    });

    // Collect term triggers
    const termTriggers = document.querySelectorAll<HTMLElement>(
      ".term-popover-trigger",
    );
    termTriggers.forEach((trigger, i) => {
      const encoded = trigger.getAttribute("data-term-content");
      if (!encoded) return;

      const config: ITriggerConfig = {
        id: `term-${i}`,
        type: "term",
        mount: document.createElement("span"),
        summary: decodeBase64(encoded),
        title: trigger.getAttribute("data-term-title") ?? undefined,
        readMoreHref: trigger.getAttribute("data-term-link") ?? undefined,
        ariaLabel: trigger.textContent ?? `Term ${i}`,
        triggerText: trigger.textContent ?? "",
      };

      config.mount.style.display = "inline";
      trigger.replaceWith(config.mount);
      disposers.push(
        render(() => <TermPopover config={config} />, config.mount),
      );
    });
  });

  onCleanup(() => {
    disposers.forEach((d) => {
      d();
    });
  });

  // No visible DOM - all popovers are rendered directly into mount points
  return undefined;
};

export default PopoverManager;
