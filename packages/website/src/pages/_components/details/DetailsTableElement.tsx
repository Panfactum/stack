import { type Component, type ParentComponent } from "solid-js";

import Tooltip from "@/components/ui/Tooltip.tsx";

import DetailsTableElementContainer from "./DetailsTableElementContainer.tsx";

interface DetailsTableElementProps {
  description?: string | Component;
  accent?: boolean;
}

const DetailsTableElement: ParentComponent<DetailsTableElementProps> = (
  props,
) => {
  return (
    <DetailsTableElementContainer accent={props.accent}>
      {props.description === undefined ? (
        props.children
      ) : (
        <>
          <Tooltip content={props.description}>
            <span class="underline decoration-dotted decoration-2 underline-offset-4">
              {props.children}
            </span>
          </Tooltip>
        </>
      )}
    </DetailsTableElementContainer>
  );
};

export default DetailsTableElement;
