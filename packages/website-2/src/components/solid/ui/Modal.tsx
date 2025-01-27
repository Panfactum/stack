import clsx from "clsx";
import { type ParentComponent } from "solid-js";

interface ModalProps {
  open: boolean;
  id: string;
  toggleOpen: () => void;
  title: string;
}

// TODO: Animate the transitions with a simple fade effect

const Modal: ParentComponent<ModalProps> = (props) => {
  return (
    <>
      <div
        id={`${props.id}-modal`}
        class={clsx(
          "fixed start-0 top-0 z-50 size-full overflow-y-auto overflow-x-hidden transition-all duration-200 ease-in-out",
          "flex items-center justify-center",
          props.open ? "block" : "hidden",
        )}
        role="dialog"
        tabIndex="-1"
        aria-labelledby={`${props.id}-modal-label`}
      >
        <div
          class={clsx(
            "absolute inset-0 bg-black",
            "transition-all duration-200 ease-in-out",
            props.open ? "opacity-50" : "opacity-0",
          )}
          on:click={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.toggleOpen();
          }}
        />
        <div
          class={clsx(
            " flex flex-col items-center gap-4",
            "relative max-h-[80vh] max-w-[80vw] overflow-x-hidden overflow-y-scroll",
            "transition-all duration-200 ease-in-out",
            "bg-primary  dark:shadow-neutral-700/70 pointer-events-auto rounded-xl border shadow-sm",
            "p-4",
            props.open ? "opacity-100" : "opacity-50",
          )}
        >
          <div class="flex w-full items-center justify-between gap-6 border-b-2 border-b-gray-warm-400 pb-1">
            <h3
              class="text-display-md self-end font-machina"
              id={`${props.id}-modal-label`}
            >
              {props.title}
            </h3>
            <button
              class=" relative -right-2 -top-2 cursor-pointer rounded bg-gray-warm-300 px-2 py-0.5 font-bold text-black hover:bg-gray-warm-400"
              on:click={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.toggleOpen();
              }}
            >
              X
            </button>
          </div>
          {props.children}
        </div>
      </div>
    </>
  );
};

export default Modal;
