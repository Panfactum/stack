// Dollar icon component for pricing and financial features
// Dollar sign icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface DollarIconProps {
  class?: string;
  size?: string | number;
}

export const DollarIcon: Component<DollarIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 14 22"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 15C1 17.2091 2.79086 19 5 19H9C11.2091 19 13 17.2091 13 15C13 12.7909 11.2091 11 9 11H5C2.79086 11 1 9.20914 1 7C1 4.79086 2.79086 3 5 3H9C11.2091 3 13 4.79086 13 7M7 1V21"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
