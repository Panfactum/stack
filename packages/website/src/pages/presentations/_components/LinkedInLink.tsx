// LinkedIn profile link with brand icon for use in presentation slides.
// Renders the LinkedIn logo as an inline anchor element.
import { clsx } from "clsx";
import { RiLogosLinkedinFill } from "solid-icons/ri";
import type { Component } from "solid-js";

interface ILinkedInLinkProps {
  url: string;
}

export const LinkedInLink: Component<ILinkedInLinkProps> = (props) => {
  return (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer"
      class={clsx("inline-flex items-center gap-2 no-underline")}
      style={{
        color: "#70bfeb",
        "font-family": "Inter, sans-serif",
        "font-size": "20px",
      }}
    >
      <RiLogosLinkedinFill
        size={36}
        style={{ color: "#0a66c2", "flex-shrink": "0" }}
      />
    </a>
  );
};
