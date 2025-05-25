import type { ParentComponent } from "solid-js";

interface DetailsTableElementContainerProps {
  accent?: boolean;
}

const DetailsTableElementContainer: ParentComponent<
  DetailsTableElementContainerProps
> = (props) => {
  return (
    <td class={`px-6 py-4 ${props.accent ? "bg-accent-dark" : ""}`}>
      <div
        class={`flex items-center justify-start whitespace-nowrap ${props.accent ? "font-semibold" : ""}`}
      >
        {props.children}
      </div>
    </td>
  );
};

export default DetailsTableElementContainer;
