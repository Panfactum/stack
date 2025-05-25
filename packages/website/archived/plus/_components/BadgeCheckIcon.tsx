import { BiRegularBadgeCheck } from "solid-icons/bi";
import type { Component } from "solid-js";

interface BadgeCheckIconProps {
  small?: boolean;
}

export const BadgeCheckIcon: Component<BadgeCheckIconProps> = (props) => {
  return (
    <BiRegularBadgeCheck
      class={`${props.small ? "ml-0.5" : "ml-1"} text-gold-500`}
      size={props.small ? 14 : 22}
    />
  );
};
