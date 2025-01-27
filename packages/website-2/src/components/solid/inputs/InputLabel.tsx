import clsx from "clsx";
import { type Component, createSignal } from "solid-js";

import Modal from "@/components/solid/ui/Modal.tsx";

import InfoIcon from "./InfoIcon";

interface InputLabelProps {
  label: string;
  id: string;
  description?: string | Component;
}

const InputLabel: Component<InputLabelProps> = (props) => {
  const [open, setOpen] = createSignal<boolean>(false);
  const toggleOpen = () => setOpen((prev) => !prev);

  const onClick = (e: MouseEvent) => {
    if (props.description) {
      e.preventDefault();
      toggleOpen();
    }
  };

  return (
    <>
      <label
        class={clsx(
          "hover:text-secondary flex cursor-pointer items-center gap-3 whitespace-nowrap text-sm font-semibold",
        )}
        for={props.id}
        onClick={onClick}
      >
        {props.label}
        {props.description && (
          <div
            class="w-4 cursor-pointer"
            aria-label={"Open details"}
            aria-description={`Open details for ${props.label}`}
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls={`${props.id}-modal`}
            data-hs-overlay={`#${props.id}-modal`}
          >
            <InfoIcon />
          </div>
        )}
      </label>

      <Modal
        open={open()}
        toggleOpen={toggleOpen}
        id={props.id}
        title={`Details: ${props.label}`}
      >
        {props.description === undefined ||
        typeof props.description === "string" ? (
          props.description
        ) : (
          <props.description />
        )}
      </Modal>
    </>
  );
};

export default InputLabel;
