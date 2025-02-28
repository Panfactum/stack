import type { Component } from "solid-js";

import Button from "@/components/ui/Button.tsx";
import { DocsVersionProvider, useDocsVersion } from "@/state/docsVersion.tsx";

interface GetStartedProps {
  size?: "sm" | "md" | "lg" | "xl";
  class?: string;
}

const _GetStartedButton: Component<GetStartedProps> = (props) => {
  const [version] = useDocsVersion();
  return (
    <a href={`/docs/${version()}/guides`} class={props.class}>
      <Button size={props.size} variant="primary" class="w-full">
        Get Started
      </Button>
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
