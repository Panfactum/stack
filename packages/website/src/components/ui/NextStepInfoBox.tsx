import type { ParentComponent } from "solid-js";

const NextStepInfoBox: ParentComponent<{
  title: string;
  content: string;
}> = (props) => {
  return (
    <div
      class={`
        rounded-md border border-primary bg-gray-dark-mode-950 p-4
        text-gray-dark-mode-50
      `}
    >
      <p class="mt-0 mb-0.5 text-lg font-semibold text-primary">
        {props.title}
      </p>
      <p class="mt-0 mb-1 text-sm text-tertiary">{props.content}</p>
      {props.children}
    </div>
  );
};

export default NextStepInfoBox;
