'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import MarkdownGuideNav from '@/components/markdown/MarkdownGuideNav'

// We use this component to make it clear to people who are following
// the bootstrapping guide that they should return to the bootstrapping
// guide instead of continuing to the rest of the "getting started" guide.
export default function NextSteps () {
  const params = useSearchParams()
  const isBootstrapping = params.get('bootstrapping') === 'true'

  if (isBootstrapping) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <p>
          Now that you have the core tooling installed, you can
          {' '}
          <Link
            href="/docs/edge/guides/bootstrapping/installing-devshell#install-prerequisite-tooling"
            className="text-primary underline hover:cursor-pointer"
          >
            return to the bootstrapping guide.
          </Link>
        </p>
      </div>
    )
  } else {
    return (
      <div className="mt-2 flex flex-col gap-2">
        We are now ready to launch your organization&apos;s developer environment.
        <MarkdownGuideNav
          backHref={'/docs/edge/guides/getting-started/overview'}
          forwardHref={'/docs/edge/guides/getting-started/boot-developer-environment'}
          stepNumber={2}
          totalSteps={4}
          progressLabel={'Getting Started Guide:'}
        />
      </div>
    )
  }
}
