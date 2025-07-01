// Close icon component for dismissing modals and closing UI elements
// X mark in circle icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface CloseIconProps {
  class?: string;
  size?: string | number;
}

export const CloseIcon: Component<CloseIconProps> = (props) => {
  return (
    <svg
      fill="currentColor"
      width={props.size || "100%"}
      viewBox="0 0 32 32"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 0c-8.836 0-16 7.163-16 16s7.163 16 16 16c8.837 0 16-7.163 16-16s-7.163-16-16-16zM16 30.032c-7.72 0-14-6.312-14-14.032s6.28-14 14-14 14 6.28 14 14-6.28 14.032-14 14.032zM21.657 10.344c-0.39-0.39-1.023-0.39-1.414 0l-4.242 4.242-4.242-4.242c-0.39-0.39-1.024-0.39-1.415 0s-0.39 1.024 0 1.414l4.242 4.242-4.242 4.242c-0.39 0.39-0.39 1.024 0 1.414s1.024 0.39 1.415 0l4.242-4.242 4.242 4.242c0.39 0.39 1.023 0.39 1.414 0s0.39-1.024 0-1.414l-4.242-4.242 4.242-4.242c0.391-0.391 0.391-1.024 0-1.414z" />
    </svg>
  );
};
