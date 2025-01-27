import { type Component, createSignal, type ParentComponent } from "solid-js";

import Tooltip from "@/components/solid/ui/Tooltip.tsx";

import DetailsTableElementContainer from "./DetailsTableElementContainer.tsx";

interface DetailsTableElementProps {
  description?: string | Component;
  accent?: boolean;
}

const DetailsTableElement: ParentComponent<DetailsTableElementProps> = (
  props,
) => {
  const [anchor, setAnchor] = createSignal<HTMLElement>();

  return (
    <DetailsTableElementContainer accent={props.accent}>
      {props.description === undefined ? (
        props.children
      ) : (
        <>
          <span
            ref={setAnchor}
            class="underline decoration-dotted decoration-2 underline-offset-4"
          >
            {props.children}
          </span>
          <Tooltip anchor={anchor()}>
            {typeof props.description === "string" ? (
              props.description
            ) : (
              <props.description />
            )}
          </Tooltip>
        </>
      )}
    </DetailsTableElementContainer>
  );
};

export default DetailsTableElement;
