// Code 2 icon component for developer tools and code snippets
// Alternative code brackets icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface Code2IconProps {
  class?: string;
  size?: string | number;
}

export const Code2Icon: Component<Code2IconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 24 24"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 8L3 11.6923L7 16M17 8L21 11.6923L17 16M14 4L10 20"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
