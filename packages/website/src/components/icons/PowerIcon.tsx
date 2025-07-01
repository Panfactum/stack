// Power icon component for on/off states and power features
// Power button icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface PowerIconProps {
  class?: string;
  size?: string | number;
}

export const PowerIcon: Component<PowerIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 20 22"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0001 1V11M16.3601 5.64C17.6185 6.89879 18.4754 8.50244 18.8224 10.2482C19.1694 11.9939 18.991 13.8034 18.3098 15.4478C17.6285 17.0921 16.4749 18.4976 14.9949 19.4864C13.515 20.4752 11.775 21.0029 9.99512 21.0029C8.21521 21.0029 6.47527 20.4752 4.99529 19.4864C3.51532 18.4976 2.36176 17.0921 1.68049 15.4478C0.999212 13.8034 0.82081 11.9939 1.16784 10.2482C1.51487 8.50244 2.37174 6.89879 3.63012 5.64"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
