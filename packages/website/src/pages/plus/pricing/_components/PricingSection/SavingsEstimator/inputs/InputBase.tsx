import { type Component, type ParentComponent, splitProps } from "solid-js";

import InputLabel from "./InputLabel.tsx";

interface InputBaseProps {
  label: string;
  id: string;
  description?: string | Component;
}

const InputBase: ParentComponent<InputBaseProps> = (props) => {
  const [_, restProps] = splitProps(props, ["children"]);

  return (
    <div class="flex flex-col gap-y-1.5">
      <InputLabel {...restProps} />
      {props.children}
    </div>
  );
};

export default InputBase;
