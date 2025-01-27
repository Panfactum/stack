import { clsx } from "clsx";
import type { JSX, ParentComponent } from "solid-js";

const sizes = {
  sm: "py-2 px-2 rounded",
  md: "py-2 md:py-3 px-3 md:px-4 rounded-xl",
  lg: "p-6 rounded-2xl",
  xl: "p-8 rounded-2xl",
};

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  tertiary: "btn-tertiary",
};

export interface ButtonProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary";
  class?: string;
  id?: string;
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
}
const Button: ParentComponent<ButtonProps> = (props) => {
  return (
    <button
      class={clsx(
        sizes[props.size ?? "md"],
        variants[props.variant ?? "primary"],
        props.class,
      )}
      id={props.id}
      on:click={props.onClick}
    >
      {props.children}
    </button>
  );
};

export default Button;
