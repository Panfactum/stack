// Check circle icon component for success states and confirmations
// Checkmark in circle icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface CheckCircleIconProps {
  class?: string;
  size?: string | number;
}

export const CheckCircleIcon: Component<CheckCircleIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 24 24"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M9 12L10.6828 13.6828V13.6828C10.858 13.858 11.142 13.858 11.3172 13.6828V13.6828L15 10"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
