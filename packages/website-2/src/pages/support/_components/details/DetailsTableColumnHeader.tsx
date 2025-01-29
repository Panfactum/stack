import { clsx } from "clsx";
import type { ParentComponent } from "solid-js";

const DetailsTableColumnHeader: ParentComponent = (props) => {
  return (
    <th
      class={clsx(
        `bg-secondary min-w-36 px-6 py-3 text-start text-sm tracking-wide lg:min-w-48`,
      )}
    >
      {props.children}
    </th>
  );
};

export default DetailsTableColumnHeader;
