import { Button as KobalteButton } from "@kobalte/core/button";
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

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary";
}
const Button: ParentComponent<ButtonProps> = (props) => {
  return (
    <KobalteButton
      as={"button"}
      {...props}
      class={clsx(
        sizes[props.size ?? "md"],
        variants[props.variant ?? "primary"],
        props.class,
      )}
    />
  );
};

export default Button;
