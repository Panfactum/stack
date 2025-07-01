// GitHub icon component using solid-icons
// Re-exports AiFillGithub from solid-icons for consistency
import { AiFillGithub } from "solid-icons/ai";
import type { Component } from "solid-js";

export const GithubIcon: Component<{ class?: string; size?: number }> = (
  props,
) => {
  return <AiFillGithub class={props.class} size={props.size} />;
};
