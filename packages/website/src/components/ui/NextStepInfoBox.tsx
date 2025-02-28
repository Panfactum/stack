import type { ParentComponent } from "solid-js";

const NextStepInfoBox: ParentComponent<{
  title: string;
  content: string;
}> = (props) => {
  return (
    <div class="border-primary bg-primary rounded-md border p-4">
      <p class="text-primary mb-0.5 mt-0 text-lg font-semibold">
        {props.title}
      </p>
      <p class="text-tertiary mb-1 mt-0 text-sm">{props.content}</p>
      {props.children}
    </div>
  );
};

export default NextStepInfoBox;
