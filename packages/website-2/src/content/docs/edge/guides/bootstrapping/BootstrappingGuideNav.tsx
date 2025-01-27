import type { Component } from "solid-js";

import MarkdownGuideNav from "@/components/solid/markdown/MarkdownGuideNav";

interface BootstrappingGuideNavProps {
  backHref: string;
  forwardHref: string;
  stepNumber: number;
}
const BootstrappingGuideNav: Component<BootstrappingGuideNavProps> = (
  props,
) => {
  return (
    <MarkdownGuideNav
      {...props}
      totalSteps={21}
      progressLabel={"Panfactum Bootstrapping Guide:"}
    />
  );
};

export default BootstrappingGuideNav;
