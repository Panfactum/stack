import {clsx} from "clsx";
import {type Component, type ParentComponent, Show} from "solid-js";

export enum ContentBlockType {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const  ContentBlockWithImage: ParentComponent<{
  class?: string;
  title: string;
  content: string;
  image?: Component;
  bgColor?: string;
  type: ContentBlockType;
}> = (props) =>  {
  return (
    <div
      class={clsx(
        "bg-primary border-primary flex w-full items-stretch overflow-hidden rounded-md border-2",
        props.type === ContentBlockType.HORIZONTAL ? "flex-col sm:flex-row" : "flex-col",
        props.class
      )}
    >
      <Show when={props.image}>
        <div
          class={clsx(
            "flex flex-none items-center justify-center text-white",
            props.bgColor,
            props.type === ContentBlockType.HORIZONTAL ? "h-[200px] w-full sm:h-auto sm:w-1/3" : "h-[200px]"
          )}
        >
          <div class="flex size-[94px] items-center justify-center rounded-full border-4">
            <div class="flex size-[72px] items-center justify-center rounded-full border-4">
              {props.image && <props.image/>}
            </div>
          </div>
        </div>
      </Show>
      <div class="flex grow flex-col justify-start gap-2 p-5">
        <p
          class="text-display-xs text-primary !m-0 font-semibold"
        >
          {props.title}
        </p>
        <p
          class="text-tertiary !m-0 text-sm"
        >
          {props.content}
        </p>
      </div>
      <div class="p-4">
        {props.children}
      </div>
    </div>
  );
}

export default ContentBlockWithImage;