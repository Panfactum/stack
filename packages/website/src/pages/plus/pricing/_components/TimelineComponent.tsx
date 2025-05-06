import { clsx } from "clsx";
import { IoWarningOutline } from "solid-icons/io";
import {
  For,
  mergeProps,
  Show,
  type Component,
  type JSXElement,
  type Setter,
} from "solid-js";

import panfactumMark from "@/components/icons/panfactum-mark.svg";
type BulletType = "panfactum" | "warning" | "panfactum-muted";

export type TimelineItemProps = {
  title: JSXElement;
  description?: JSXElement;
  bullet?: Component<{ class: string; size: number }> | "panfactum";
  isLast?: boolean;
  bulletSize: number;
  time?: string;
  type: BulletType;
  lineSize: number;
};

export type TimelinePropsItem = Omit<
  TimelineItemProps,
  "bulletSize" | "lineSize"
> & {
  time?: string;
  type: BulletType;
};

export type TimelineProps = {
  items: TimelinePropsItem[];
  buttons: {
    icon?: Component<{ class: string; size: number }>;
    text: string;
    callbackValue: 2 | 1 | 3;
  }[];
  bulletSize?: number;
  buttonCallback: Setter<2 | 1 | 3>;
};

const Timeline: Component<TimelineProps> = (rawProps) => {
  const props = mergeProps({ bulletSize: 16, lineSize: 2 }, rawProps);

  return (
    <ul
      style={{
        "padding-left": `${props.bulletSize / 2 + 80}px`,
      }}
    >
      <For each={props.items}>
        {(item, index) => (
          <TimelineItem
            type={item.type}
            title={item.title}
            description={item.description}
            bullet={item.bullet}
            time={item.time}
            isLast={
              index() === props.items.length - 1 && props.buttons.length === 0
            }
            bulletSize={props.bulletSize}
            lineSize={props.lineSize}
          />
        )}
      </For>

      {/* Buttons section */}
      <Show when={props.buttons.length > 0}>
        <li
          class="relative border-l border-l-white dark:border-l-gray-dark-mode-600"
          style={{ "border-left-width": `${props.lineSize}px` }}
        >
          <div class="flex flex-col gap-4 pl-8">
            <For each={props.buttons}>
              {(button, index) => {
                const isLastButton = index() === props.buttons.length - 1;

                return (
                  <div class={clsx("relative", !isLastButton && "mb-2")}>
                    {/* Horizontal connector line */}
                    <div
                      class="absolute bg-white dark:bg-gray-dark-mode-600"
                      style={{
                        width: "24px",
                        height: `${props.lineSize}px`,
                        left: "-32px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    />

                    <button
                      class={clsx(
                        "flex items-center rounded-md border px-4 py-2 font-semibold focus:outline-none focus:ring-2",
                        "border-brand-300 bg-white text-brand-700 hover:bg-brand-50 focus:ring-brand-500",
                        "dark:border-gray-dark-mode-700 dark:bg-gray-dark-mode-900 dark:text-gray-dark-mode-300 dark:hover:bg-gray-dark-mode-800 dark:focus:ring-gray-dark-mode-700",
                      )}
                      onClick={() => props.buttonCallback(button.callbackValue)}
                    >
                      <Show when={button.icon}>
                        {(Icon) => {
                          const IconComponent = Icon();
                          return <IconComponent class="mr-2" size={24} />;
                        }}
                      </Show>
                      <span>{button.text}</span>
                    </button>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Hide the vertical line below the last button */}
          <div
            class="absolute bg-gray-light-mode-950 dark:bg-gray-dark-mode-800"
            style={{
              width: `${props.lineSize}px`,
              height: "100%",
              left: "-2px",
              top: `calc(${props.buttons.length * 44}px)`,
              "z-index": "1",
            }}
          />
        </li>
      </Show>
    </ul>
  );
};

const TimelineItem: Component<TimelineItemProps> = (props) => {
  return (
    <li
      class={clsx(
        "relative border-l pb-8 pl-8",
        props.isLast
          ? "border-l-transparent pb-0"
          : "border-l-white dark:border-l-gray-dark-mode-600",
      )}
      style={{
        "border-left-width": `${props.lineSize}px`,
      }}
    >
      <Show when={props.time}>
        <div
          class="absolute text-sm text-white"
          style={{
            right: `calc(100% + ${props.bulletSize + 8}px)`,
            top: `${props.bulletSize / 4}px`,
            "white-space": "nowrap",
          }}
        >
          {props.time}
        </div>
      </Show>
      <div
        class={clsx(
          `absolute top-0 flex items-center justify-center rounded-full`,
          props.type === "panfactum" && "bg-brand-500",
          props.type === "panfactum-muted" && "bg-brand-700",
          props.type === "warning" && "bg-gold-300",
        )}
        style={{
          width: `${props.bulletSize}px`,
          height: `${props.bulletSize}px`,
          left: `${-props.bulletSize / 2 - props.lineSize / 2}px`,
        }}
        aria-hidden="true"
      >
        <Show when={props.bullet && props.bullet !== "panfactum"}>
          {/* @ts-expect-error props.bullet is for sure a component */}
          <props.bullet class="text-white" size={props.bulletSize / 2} />
        </Show>
        <Show when={props.bullet === "panfactum"}>
          <img
            src={panfactumMark.src}
            alt="Panfactum Logo"
            class="size-6"
            style={{
              filter: "brightness(0) invert(1)",
            }}
          />
        </Show>
      </div>
      <div
        class="mb-3 font-semibold leading-none text-white"
        style={{
          "padding-top": `${props.bulletSize / 3}px`,
        }}
      >
        {props.title}
      </div>
      <Show when={props.description && props.type !== "warning"}>
        <p class="text-sm text-white">{props.description}</p>
      </Show>
      <Show when={props.description && props.type === "warning"}>
        <div class="rounded bg-gray-light-mode-600 ">
          <div class="mx-2 flex items-center p-2">
            <IoWarningOutline class="mr-2 text-gold-300" size={20} />
            <p class="text-sm text-white">{props.description}</p>
          </div>
        </div>
      </Show>
    </li>
  );
};

export { Timeline };
