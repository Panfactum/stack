import { clsx } from "clsx";
import { type Component, Show } from "solid-js";

const SeparatorWithText: Component<{
  text?: string;
  class?: string;
}> = (props) => {
  return (
    <div class={clsx("relative flex min-h-[16px] items-center", props.class)}>
      <div class="h-px w-full flex-1 border-b border-primary" />
      <Show when={props.text}>
        <p
          class="px-2 text-lg font-semibold"
          style={{ "margin-top": 0, "margin-bottom": 0 }}
        >
          {props.text}
        </p>
      </Show>
      <div class="h-px w-full flex-1 border-b border-primary" />
    </div>
  );
};

export default SeparatorWithText;
