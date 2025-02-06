import type { Component } from "solid-js";

import Button from "@/components/ui/Button.tsx";
import {DocsVersionProvider, useDocsVersion} from "@/state/docsVersion.tsx";

interface GetStartedProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const _GetStartedButton: Component<GetStartedProps> = (props) => {
  const [version] = useDocsVersion()
  return (
    <a href={`/docs/${version()}/guides`}>
      <Button size={props.size} variant="primary" class="w-full">
        Get Started
      </Button>
    </a>
  );
};

const GetStartedButton: Component<GetStartedProps & {fullPath: string}> = (props) => {
  return (
    <DocsVersionProvider fullPath={props.fullPath}>
      <_GetStartedButton size={props.size}/>
    </DocsVersionProvider>
  )
}

export default GetStartedButton;
