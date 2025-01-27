import type { ParentComponent } from "solid-js";

interface InputRowProps {
  title: string;
}

const InputRow: ParentComponent<InputRowProps> = (props) => {
  return (
    <div class="flex w-full flex-col items-start gap-y-4 px-8 py-4 md:gap-y-2 lg:flex-row">
      <div
        class={`text-display-sm min-w-[300px] basis-1/5 self-start py-4 font-semibold underline lg:py-0 lg:text-left lg:no-underline`}
      >
        {props.title}
      </div>
      <div class="grid w-full basis-4/5 grid-cols-1 gap-4 gap-y-8  sm:grid-cols-2 lg:grid-cols-3">
        {props.children}
      </div>
    </div>
  );
};

export default InputRow;
