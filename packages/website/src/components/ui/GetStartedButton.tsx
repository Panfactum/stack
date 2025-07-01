import { clsx } from "clsx";
import type { Component } from "solid-js";

import { DocsVersionProvider, useDocsVersion } from "@/state/docsVersion.tsx";

interface GetStartedProps {
  size?: "sm" | "md" | "lg" | "xl";
  class?: string;
}

const _GetStartedButton: Component<GetStartedProps> = (props) => {
  const [version] = useDocsVersion();

  const sizeClasses = {
    sm: "px-4 py-2.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
    xl: "px-10 py-5 text-xl",
  };

  return (
    <a
      href={`/docs/${version()}/guides`}
      class={clsx(
        `
          inline-block rounded-lg bg-brand-500 font-bold text-white
          transition-colors
          hover:bg-brand-700
        `,
        // eslint-disable-next-line better-tailwindcss/no-unregistered-classes
        sizeClasses[props.size || "md"],
        props.class,
      )}
    >
      Get Started
    </a>
  );
};

const GetStartedButton: Component<GetStartedProps & { fullPath: string }> = (
  props,
) => {
  return (
    <DocsVersionProvider fullPath={props.fullPath}>
      <_GetStartedButton size={props.size} class={props.class} />
    </DocsVersionProvider>
  );
};

export default GetStartedButton;
