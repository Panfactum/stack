// Eye icon component for visibility toggles and view features
// Eye open icon rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface EyeIconProps {
  class?: string;
  size?: string | number;
}

export const EyeIcon: Component<EyeIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 22 16"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.42012 8.71318C1.28394 8.49754 1.21584 8.38972 1.17772 8.22342C1.14909 8.0985 1.14909 7.9015 1.17772 7.77658C1.21584 7.61028 1.28394 7.50246 1.42012 7.28682C2.54553 5.50484 5.8954 1 11.0004 1C16.1054 1 19.4553 5.50484 20.5807 7.28682C20.7169 7.50246 20.785 7.61028 20.8231 7.77658C20.8517 7.9015 20.8517 8.0985 20.8231 8.22342C20.785 8.38972 20.7169 8.49754 20.5807 8.71318C19.4553 10.4952 16.1054 15 11.0004 15C5.8954 15 2.54553 10.4952 1.42012 8.71318Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M11.0004 11C12.6573 11 14.0004 9.65685 14.0004 8C14.0004 6.34315 12.6573 5 11.0004 5C9.34355 5 8.0004 6.34315 8.0004 8C8.0004 9.65685 9.34355 11 11.0004 11Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
