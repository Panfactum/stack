// Database icon component for data storage and database features
// Cylinder database icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface DatabaseIconProps {
  class?: string;
  size?: string | number;
}

export const DatabaseIcon: Component<DatabaseIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 20 22"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19 4C19 5.65685 14.9706 7 10 7C5.02944 7 1 5.65685 1 4M19 4C19 2.34315 14.9706 1 10 1C5.02944 1 1 2.34315 1 4M19 4V18C19 19.66 15 21 10 21C5 21 1 19.66 1 18V4M19 11C19 12.66 15 14 10 14C5 14 1 12.66 1 11"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  );
};
