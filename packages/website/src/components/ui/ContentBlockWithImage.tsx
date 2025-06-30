import { clsx } from "clsx";
import { type Component, type ParentComponent, Show } from "solid-js";

export enum ContentBlockType {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

const ContentBlockWithImage: ParentComponent<{
  class?: string;
  title: string;
  content: string;
  image?: Component;
  bgColor?: string;
  type: ContentBlockType;
}> = (props) => {
  return (
    <div
      class={clsx(
        `
          flex w-full items-stretch overflow-hidden rounded-md border-2
          border-primary bg-gray-dark-mode-950 text-gray-dark-mode-50
        `,
        props.type === ContentBlockType.HORIZONTAL
          ? `
            flex-col
            sm:flex-row
          `
          : "flex-col",
        props.class,
      )}
    >
      <Show when={props.image}>
        <div
          class={clsx(
            "flex flex-none items-center justify-center",
            props.bgColor,
            props.type === ContentBlockType.HORIZONTAL
              ? `
                h-[200px] w-full
                sm:h-auto sm:w-1/3
              `
              : "h-[200px]",
          )}
        >
          <div
            class={`
              flex size-[94px] items-center justify-center rounded-full border-4
              !text-gray-modern-400
            `}
          >
            <div
              class={`
                flex size-[72px] items-center justify-center rounded-full
                border-4 !text-gray-modern-400
              `}
            >
              {props.image && <props.image />}
            </div>
          </div>
        </div>
      </Show>
      <div class="flex grow flex-col justify-start gap-2 p-5">
        <p class="!m-0 text-display-xs font-semibold text-primary">
          {props.title}
        </p>
        <p class="!m-0 text-sm text-tertiary">{props.content}</p>
      </div>
      <div class="p-4">{props.children}</div>
    </div>
  );
};

export default ContentBlockWithImage;
