import { Show, type Component } from "solid-js";

interface SavingsDescriptionLineItemProps {
  content: string;
  operation?: string;
}

const SavingsDescriptionLineItem: Component<SavingsDescriptionLineItemProps> = (
  props,
) => {
  return (
    <Show
      when={props.operation}
      fallback={
        <div class="max-w-[75vw] text-wrap pl-8 -indent-8">
          &nbsp;&nbsp; {props.content}
        </div>
      }
    >
      <div class="max-w-[75vw] text-wrap pl-8 -indent-8">
        {props.operation} {props.content}
      </div>
    </Show>
  );
};

export default SavingsDescriptionLineItem;
