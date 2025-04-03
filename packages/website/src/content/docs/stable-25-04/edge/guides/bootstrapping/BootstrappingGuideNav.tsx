import MarkdownGuideNav from "@/components/markdown/MarkdownGuideNav.tsx";

interface BootstrappingGuideNavProps {
  backHref?: string;
  forwardHref?: string;
  stepNumber: number;
}
export default function BootstrappingGuideNav(
  props: BootstrappingGuideNavProps,
) {
  return (
    <MarkdownGuideNav
      {...props}
      totalSteps={21}
      progressLabel={"Panfactum Bootstrapping Guide:"}
    />
  );
}
