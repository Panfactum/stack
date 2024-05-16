import MarkdownGuideNav from '@/components/markdown/MarkdownGuideNav'

interface BootstrappingGuideNavProps {
  backHref?: string;
  forwardHref?: string;
  stepNumber: number
}
export default function BootstrappingGuideNav (props: BootstrappingGuideNavProps) {
  return (
    <MarkdownGuideNav
      {...props}
      totalSteps={20}
      progressLabel={'Panfactum Bootstrapping Guide:'}
    />
  )
}
