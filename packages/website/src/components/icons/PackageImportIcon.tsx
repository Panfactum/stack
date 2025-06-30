// Package import icon component for import/installation features
// Package box with import arrow icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface PackageImportIconProps {
  class?: string;
  size?: string | number;
}

export const PackageImportIcon: Component<PackageImportIconProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || "24"}
      height={props.size || "24"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 21l-8 -4.5v-9l8 -4.5l8 4.5v4.5" />
      <path d="M12 12l8 -4.5" />
      <path d="M12 12v9" />
      <path d="M12 12l-8 -4.5" />
      <path d="M22 18h-7" />
      <path d="M18 15l-3 3l3 3" />
    </svg>
  );
};
