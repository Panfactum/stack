// Tool icon component for utilities and configuration features
// Wrench/tool icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface ToolIconProps {
  class?: string;
  size?: string | number;
}

export const ToolIcon: Component<ToolIconProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || "100%"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />
    </svg>
  );
};
