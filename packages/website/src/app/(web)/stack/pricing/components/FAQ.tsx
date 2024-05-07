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

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'
import PrettyBalancer from '@/components/ui/PrettyBalancer'

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
      className="bg-primary text-white text-base sm:text-xl font-normal"
      {...props}
    />
  )
}

function CustomAccordianDetails (props: AccordionDetailsProps) {
  return (
    <AccordionDetails
      className="bg-neutral p-0 border-solid border-secondary border-x-[1px] border-b-[1px] px-4 py-2"
      {...props}
    />
  )
}

interface FAQProps {
  title: string;
  helpText?: string;
  answerSections: Array<string | ReactElement>;
}

export default function FAQ (props: FAQProps) {
  const { answerSections, title, helpText } = props
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
        {answerSections.map((answer, i) => (
          <p
            key={i}
            className="py-2 text-sm sm:text-lg"
          >
            <PrettyBalancer>
              {answer}
            </PrettyBalancer>
          </p>
        ))}
      </CustomAccordianDetails>
    </CustomAccordion>
  )
}
