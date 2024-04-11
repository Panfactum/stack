import ArrowLeftIcon from '@mui/icons-material/ArrowLeft'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import LinearProgress from '@mui/material/LinearProgress'
import Link from 'next/link'
import { memo } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

function MarkdownGuideNavButton (props: {href: string | undefined, tooltip: string, text: string, icon: 'left' | 'right'}) {
  const { href, tooltip, text, icon } = props

  if (href === undefined) {
    return <div className="w-36"/>
  }

  const Icon = icon === 'left' ? ArrowLeftIcon : ArrowRightIcon

  return (
    <DefaultTooltipLazy title={tooltip}>
      <Link
        href={href}
        className="flex items-center justify-around bg-primary text-white w-28 lg:w-36 py-1.5 text-xs sm:text-base rounded-md"
      >
        {icon === 'right' ? null : <Icon className="p-0 m-[-1rem] lg:w-[2.5rem] lg:h-[2.5rem]"/>}
        {text}
        {icon === 'left' ? null : <Icon className="p-0 m-[-1rem] lg:w-[2.5rem] lg:h-[2.5rem]"/>}
      </Link>
    </DefaultTooltipLazy>
  )
}

interface MarkdownGuideNavProps {
  backHref?: string | undefined
  backText?: string | undefined
  backTooltip?: string | undefined
  forwardHref?: string | undefined
  forwardText?: string | undefined
  forwardTooltip?: string | undefined
  stepNumber?: number | undefined
  totalSteps?: number | undefined
  progressLabel?: string | undefined
}

export default memo(function MarkdownGuideNav (props: MarkdownGuideNavProps) {
  const {
    backHref,
    backText = 'Previous',
    backTooltip = 'Previous page',
    forwardHref,
    forwardText = 'Next',
    forwardTooltip = 'Next page',
    stepNumber,
    totalSteps = 10,
    progressLabel
  } = props

  return (
    <div className="w-full flex flex-col gap-2 py-4">
      <div className=" flex justify-between items-end">
        <MarkdownGuideNavButton
          href={backHref}
          text={backText}
          tooltip={backTooltip}
          icon={'left'}
        />
        {stepNumber === undefined
          ? <div/>
          : (
            <div className="justify-center gap-3 hidden lg:flex">
              <div className="font-bold">
                {progressLabel}
              </div>
              <div>
                {' '}
                Step
                {' '}
                {stepNumber}
                {' '}
                /
                {totalSteps}
              </div>
            </div>
          )}
        <MarkdownGuideNavButton
          href={forwardHref}
          text={forwardText}
          tooltip={forwardTooltip}
          icon={'right'}
        />
      </div>
      {stepNumber === undefined
        ? <div/>
        : (
          <div className="flex flex-col gap-3">
            <LinearProgress
              color="primary"
              variant="determinate"
              value={Math.round(stepNumber / totalSteps * 100)}
            />
            <div className="justify-center gap-3 flex lg:hidden text-xs sm:text-base">
              <div className="font-bold">
                {progressLabel}
              </div>
              <div>
                {' '}
                Step
                {' '}
                {stepNumber}
                {' '}
                /
                {totalSteps}
              </div>
            </div>
          </div>
        )}
    </div>

  )
})
