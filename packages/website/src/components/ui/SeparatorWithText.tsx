import { clsx } from "clsx";
import { type Component, Show } from "solid-js";

const SeparatorWithText: Component<{
  text?: string;
  class?: string;
}> = (props) => {
  return (
    <div class={clsx("relative flex min-h-[16px] items-center", props.class)}>
      <div class="border-primary h-px w-full flex-1 border-b" />
      <Show when={props.text}>
        <p
          class="px-2 text-lg font-semibold"
          style={{ "margin-top": 0, "margin-bottom": 0 }}
        >
          {props.text}
        </p>
      </Show>
      <div class="border-primary h-px w-full flex-1 border-b" />
    </div>
  );
};

export default SeparatorWithText;
