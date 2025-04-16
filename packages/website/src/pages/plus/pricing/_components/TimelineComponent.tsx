import { clsx } from "clsx";
import {
  For,
  mergeProps,
  Show,
  type Component,
  type JSXElement,
} from "solid-js";

// Originally from https://www.solid-ui.com/docs/components/timeline
// Modified to fit our needs

type BulletType = "panfactum" | "warning" | "panfactum-muted";

export type TimelineItemProps = {
  title: JSXElement;
  description?: JSXElement;
  bullet?: JSXElement;
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
  bulletSize?: number;
};

const Timeline: Component<TimelineProps> = (rawProps) => {
  const props = mergeProps({ bulletSize: 16, lineSize: 2 }, rawProps);

  return (
    <ul
      style={{
        "padding-left": `${props.bulletSize / 2 + 80}px`, // Added extra space for time
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
            isLast={index() === props.items.length - 1}
            bulletSize={props.bulletSize}
            lineSize={props.lineSize}
          />
        )}
      </For>
    </ul>
  );
};

const TimelineItem: Component<TimelineItemProps> = (props) => {
  return (
    <li
      class={clsx(
        "relative border-l pb-8 pl-8",
        props.isLast ? "border-l-transparent pb-0" : "border-l-white",
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
          `absolute top-0 flex items-center justify-center rounded-full border`,
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
        {props.bullet}
      </div>
      <div
        class="mb-3 font-semibold leading-none text-white"
        style={{
          "padding-top": `${props.bulletSize / 3}px`,
        }}
      >
        {props.title}
      </div>
      <Show when={props.description}>
        <p class={clsx("text-sm", "text-white")}>{props.description}</p>
      </Show>
    </li>
  );
};

export { Timeline };
