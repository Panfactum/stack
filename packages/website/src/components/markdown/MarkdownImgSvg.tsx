import type { Component } from "solid-js";

interface MarkdownImgSvgProps {
  src: string;
  alt: string;
}

const MarkdownImageSvg: Component<MarkdownImgSvgProps> = (props) => {
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(props.src)}`}
      alt={props.alt}
      class="mx-auto block h-fit w-4/5 max-w-full object-contain py-4"
    />
  );
};

export default MarkdownImageSvg;
