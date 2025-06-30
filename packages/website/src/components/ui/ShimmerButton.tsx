// Shimmer button component with animated border effect
// Used for primary CTAs throughout the site

import { clsx } from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "./ShimmerButton.module.css";

interface IShimmerButtonProps {
  href: string;
  children: JSX.Element;
  class?: string;
  target?: string;
  rel?: string;
  onClick?: (e: MouseEvent) => void;
}

export const ShimmerButton: Component<IShimmerButtonProps> = (props) => {
  return (
    <a
      href={props.href}
      target={props.target}
      rel={props.rel}
      onClick={(e) => props.onClick?.(e)}
      class={clsx(
        styles.shimmerBorder,
        "rounded-lg text-base",
        "pointer-events-auto bg-brand-800 font-semibold",
        props.class,
      )}
    >
      <span class="relative z-10 inline-flex items-center px-6 py-3">
        {props.children}
      </span>
    </a>
  );
};
