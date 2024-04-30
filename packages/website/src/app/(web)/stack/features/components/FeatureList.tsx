import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type {
  AccordionDetailsProps,
  AccordionProps,
  AccordionSummaryProps
} from '@mui/material'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import type { ReactElement } from 'react'
import React from 'react'
import Balancer from 'react-wrap-balancer'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

import type { Status } from './StatusChip'
import StatusChip from './StatusChip'

function CustomAccordion (props: AccordionProps) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      square
      {...props}
      className="w-full border-gray-dark border-solid border-b-[2px] last:rounded-b-lg"
      sx={{
        '&:not(:last-child)': {
          borderBottom: 0
        },
        '&::before': {
          display: 'none'
        }
      }}
    />
  )
}

function CustomAccordionSummary (props: AccordionSummaryProps) {
  return (
    <AccordionSummary
      expandIcon={<ExpandMoreIcon className="text-white"/>}
      className="bg-primary text-white text-lg sm:text-xl"
      {...props}
    />
  )
}

function CustomAccordianDetails (props: AccordionDetailsProps) {
  return (
    <AccordionDetails
      className="bg-neutral p-0 border-solid border-secondary border-x-[1px]"
      {...props}
    />
  )
}

interface FeatureListProps {
  title: string;
  helpText?: string;
  features: Array<{
    title: string;
    description?: string | ReactElement;
    status: Status
  }>
}

export default function FeatureList (props: FeatureListProps) {
  const { features, title, helpText } = props
  return (
    <CustomAccordion>
      <CustomAccordionSummary>
        <div className="flex items-center gap-4">
          {title}
          {helpText && (
            <DefaultTooltipLazy title={helpText}>
              <HelpOutlineIcon/>
            </DefaultTooltipLazy>
          )}
        </div>

      </CustomAccordionSummary>
      <CustomAccordianDetails>
        <div className="flex flex-col">
          {features.map(({ title, description, status }) => (
            <div
              key={title}
              className="flex justify-between items-center gap-4 px-4 py-2 even:bg-gray-light odd:bg-neutral"
            >
              <div className="font-medium sm:text-lg">
                <Balancer>
                  {title}
                  {' '}
                  {description && (
                    <DefaultTooltipLazy title={description}>
                      <HelpOutlineIcon className="inline relative top-[6px]"/>
                    </DefaultTooltipLazy>
                  )}
                </Balancer>

              </div>
              <div>
                <StatusChip status={status}/>
              </div>
            </div>
          ))}
        </div>
      </CustomAccordianDetails>
    </CustomAccordion>
  )
}
