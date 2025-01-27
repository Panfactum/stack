import MarkdownGuideNav from '@/components/solid/markdown/MarkdownGuideNav'

interface BootstrappingGuideNavProps {
  backHref?: string;
  forwardHref?: string;
  stepNumber: number
}
export default function BootstrappingGuideNav (props: BootstrappingGuideNavProps) {
  return (
    <MarkdownGuideNav
      {...props}
      totalSteps={21}
      progressLabel={'Panfactum Bootstrapping Guide:'}
    />
  )
}
