import type { ParentComponent } from "solid-js";

const CalculatorDescriptionContainer: ParentComponent = (props) => (
  <div class="flex max-w-screen-lg flex-col gap-4 px-5 py-2">
    {props.children}
  </div>
);

export default CalculatorDescriptionContainer;
