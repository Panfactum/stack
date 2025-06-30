// Bar break icon component for UI elements and separators
// Line break or separator icon rendered as a SolidJS component
import type { Component } from "solid-js";

interface BarBreakIconProps {
  class?: string;
  size?: string | number;
}

export const BarBreakIcon: Component<BarBreakIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 21 21"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 2H5.8C4.11984 2 3.27976 2 2.63803 2.32698C2.07354 2.6146 1.6146 3.07354 1.32698 3.63803C1 4.27976 1 5.11984 1 6.8V15.2C1 16.8802 1 17.7202 1.32698 18.362C1.6146 18.9265 2.07354 19.3854 2.63803 19.673C3.27976 20 4.11984 20 5.8 20H14.2C15.8802 20 16.7202 20 17.362 19.673C17.9265 19.3854 18.3854 18.9265 18.673 18.362C19 17.7202 19 16.8802 19 15.2V12M10 7H14V11M13.5 2.5V1M17.4393 3.56066L18.5 2.5M18.5103 7.5H20.0103M1 12.3471C1.65194 12.4478 2.31987 12.5 3 12.5C7.38636 12.5 11.2653 10.3276 13.6197 7"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
