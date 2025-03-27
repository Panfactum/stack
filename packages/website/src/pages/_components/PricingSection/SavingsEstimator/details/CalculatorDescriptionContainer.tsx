import type { ParentComponent } from "solid-js";

const CalculatorDescriptionContainer: ParentComponent = (props) => (
  <div class="flex max-w-[80vw] flex-col gap-4 px-5 py-2 lg:max-w-screen-lg [&_a]:cursor-pointer [&_a]:underline [&_a]:underline-offset-4">
    {props.children}
  </div>
);

export default CalculatorDescriptionContainer;
