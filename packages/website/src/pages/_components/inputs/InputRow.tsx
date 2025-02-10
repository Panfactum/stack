import {clsx} from "clsx";
import {type Component, createSignal, type ParentComponent, Show} from "solid-js";

import InfoIcon from "@/components/inputs/InfoIcon.tsx";
import Modal from "@/components/ui/Modal.tsx";

interface InputRowProps {
  title: string;
  description?: string | Component;
  withPrice?: boolean;
}

const InputRow: ParentComponent<InputRowProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const toggleOpen = () => setOpen(open => !open)
  return (
    <>
      <div class={clsx(
        "flex w-full flex-col gap-y-3 overflow-visible px-8 py-6 md:gap-y-2 lg:flex-row",
        props.withPrice ? "items-start" : "items-start xl:items-center"
        )}
      >
        <div
          class={`text-display-sm min-w-[300px] basis-1/5 overflow-visible py-4 font-semibold underline lg:py-0 lg:text-left lg:no-underline`}
        >
          <Show
            when={props.description}
            fallback={props.title}
          >
            <button
              class="hover:text-secondary flex cursor-pointer items-center gap-4 overflow-visible"
              onClick={toggleOpen}
            >
              <span>
                {props.title}
              </span>
              <div class="w-5 overflow-visible">
                <InfoIcon/>
              </div>
            </button>
          </Show>
        </div>
        <div class={clsx(
          "grid w-full basis-4/5 gap-4 gap-y-8",
          props.withPrice ? "grid-cols-2 items-end xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        )}>
          {props.children}
        </div>
      </div>
      <Show when={props.description}>
        <Modal
          open={open()}
          toggleOpen={toggleOpen}
          id={`${props.title}-description`}
          title={`Details: ${props.title}`}
        >
          {props.description === undefined ||
          typeof props.description === "string" ? (
            props.description
          ) : (
            <props.description/>
          )}
        </Modal>
      </Show>
    </>

  );
};

export default InputRow;
