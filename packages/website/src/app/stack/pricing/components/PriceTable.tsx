import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Link from 'next/link'
import type { ReactElement } from 'react'
import React from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

function PriceTableColHeader ({ children }: {children: ReactElement | string}) {
  return (
    <th className="bg-primary text-white py-2 sm:py-3 tracking-wide w-[25%] font-medium">
      {children}
    </th>
  )
}

function PriceTableElementContainer ({ children }: {children: ReactElement | string}) {
  return (
    <td className="py-2 sm:py-3">
      <div className="flex items-center justify-center whitespace-nowrap">
        {children}
      </div>
    </td>
  )
}

function PriceTableElement ({ content, description }: {content: string | boolean | ReactElement, description?: string}) {
  if (typeof content === 'boolean' && content) {
    const contentEl = (
      <CheckCircleIcon
        aria-label={'Included'}
        className={`text-primary ${description ? 'border-dotted h-[30px] pb-1 border-b-[2px] border-primary relative top-1' : ''}`}
      />
    )
    return (
      <PriceTableElementContainer>
        {description === undefined
          ? contentEl
          : (
            <DefaultTooltipLazy title={description}>
              {contentEl}
            </DefaultTooltipLazy>
          )
        }
      </PriceTableElementContainer>
    )
  } else {
    const contentEl = content || <span aria-label={'Not Included'}>&#8212;</span>
    return (
      <PriceTableElementContainer>
        {description === undefined
          ? contentEl
          : (
            <DefaultTooltipLazy title={description}>
              <span className="underline decoration-dotted decoration-accent decoration-2 underline-offset-4">
                {contentEl}
              </span>
            </DefaultTooltipLazy>
          )
        }
      </PriceTableElementContainer>
    )
  }
}

interface PriceTableRowProps {
  header: string;
  headerDescription?: string | ReactElement;
  communityPlanIncluded?: boolean;
  communityPlanContent: string | boolean | ReactElement;
  communityPlanDescription?: string;
  startupPlanContent: string | boolean | ReactElement;
  startupPlanDescription?: string;
  enterprisePlanContent: string | boolean | ReactElement;
  enterprisePlanDescription?: string;
}
function PriceTableRow (props: PriceTableRowProps) {
  const {
    header,
    headerDescription,
    communityPlanContent,
    communityPlanDescription,
    startupPlanContent,
    startupPlanDescription,
    enterprisePlanContent,
    enterprisePlanDescription
  } = props

  return (
    <tr className="m-0 bg-neutral border-b-[1px] border-r-[1px] border-solid border-secondary">
      <th className="bg-primary text-white tracking-wide text-left pl-4 whitespace-nowrap font-medium">
        {headerDescription === undefined
          ? header
          : (
            <DefaultTooltipLazy title={headerDescription}>
              <span className="underline decoration-dotted decoration-white decoration-2 underline-offset-4">
                {header}
              </span>
            </DefaultTooltipLazy>
          )}
      </th>
      <PriceTableElement
        content={communityPlanContent}
        description={communityPlanDescription}
      />
      <PriceTableElement
        content={startupPlanContent}
        description={startupPlanDescription}
      />
      <PriceTableElement
        content={enterprisePlanContent}
        description={enterprisePlanDescription}
      />
    </tr>
  )
}

export default function PriceTable () {
  return (
    <table className="border-collapse text-base lg:text-lg table-fixed min-w-[850px] lg:min-w-[990px]">
      <thead>
        <tr>
          <th className="invisible w-[11em] w-[10em]">Feature</th>
          <PriceTableColHeader>Community</PriceTableColHeader>
          <PriceTableColHeader>Startup</PriceTableColHeader>
          <PriceTableColHeader>Enterprise</PriceTableColHeader>
        </tr>

      </thead>
      <tbody>
        <PriceTableRow
          header={''}
          communityPlanContent={false}
          startupPlanContent={(
            <Link
              href={'/stack/pricing/contact'}
              className="bg-primary text-white py-1 px-4 rounded"
            >
              Sign Up
            </Link>
          )}
          enterprisePlanContent={(
            <Link
              href={'/stack/pricing/contact'}
              className="bg-primary text-white py-1 px-4 rounded"
            >
              Sign Up
            </Link>
          )}
        />
        <PriceTableRow
          header={'Base Price'}
          communityPlanContent={'Free Forever'}
          communityPlanDescription={'No account or license key needed'}
          startupPlanContent={'$1,000 / month'}
          startupPlanDescription={'Plus any applicable VAT / sales tax'}
          enterprisePlanContent={'Custom'}
          enterprisePlanDescription={'Pricing starts at $5,000 / month and scales based on level of support, training, and MSA tailoring that your organization needs.'}
        />
        <PriceTableRow
          header={'Restrictions'}
          communityPlanContent={'< $1M Annual Revenue'}
          communityPlanDescription={'Free for proofs-of-concept, individuals, and organizations with less than $1M revenue for the trailing 12 months'}
          startupPlanContent={'< $5M Annual Revenue'}
          startupPlanDescription={'Organizations with less than $5M revenue for the trailing 12 months'}
          enterprisePlanContent={false}
        />
        <PriceTableRow
          header={'Cluster Count'}
          headerDescription={'Number of Kubernetes clusters you may deploy with the Panfactum stack'}
          communityPlanContent={'Unlimited'}
          startupPlanContent={'Unlimited'}
          enterprisePlanContent={'Unlimited'}
        />
        <PriceTableRow
          header={'User Count'}
          headerDescription={'Number of people in your organization using the Panfactum stack'}
          communityPlanContent={'Unlimited'}
          startupPlanContent={'Unlimited'}
          enterprisePlanContent={'Unlimited'}
        />
        <PriceTableRow
          header={'Release Channels'}
          headerDescription={(
            <span>
              We distribute two channels for the Panfactum Stack, edge and stable.
              Learn more
              {' '}
              <Link
                href="/docs/edge/guides/versioning/releases"
                className="text-white underline hover:cursor-pointer"
              >
                here.
              </Link>
            </span>
          )}
          communityPlanContent={'Edge'}
          communityPlanDescription={'No semantic versioning. Bugfixes and security issues will not be backported.'}
          startupPlanContent={'Stable'}
          enterprisePlanContent={'Stable'}
        />
        <PriceTableRow
          header={'Support SLA'}
          communityPlanContent={false}
          startupPlanContent={'72 hour'}
          enterprisePlanContent={'1 hour'}
          enterprisePlanDescription={'1 hour SLA for P0 emergencies. Different SLAs apply for other priority levels.'}
        />
        <PriceTableRow
          header={'Implementation Support'}
          headerDescription={'We will deploy the stack side-by-side with your engineering team.'}
          communityPlanContent={false}
          startupPlanContent={true}
          startupPlanDescription={'Additional, one-time cost'}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'Boosted GH Issues'}
          headerDescription={(
            <span>
              Issues files against the
              {' '}
              <Link
                href="https://github.com/Panfactum/stack"
                className="text-white underline hover:cursor-pointer"
              >
                Panfactum Github repository
              </Link>
              {' '}
              will receive prioritization on the roadmap.
            </span>
          )}
          communityPlanContent={false}
          startupPlanContent={true}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'Embedded Support'}
          headerDescription={'Our support team will be available directly in your instant messaging service.'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'Dedicated Engineer'}
          headerDescription={'We will assign a dedicated engineer to understand and assist with your specific deployment scenario. They will aid in addressing any issues and can provide one-on-one guidance and planning support.'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'Custom MSA'}
          headerDescription={'We will work alongside your legal and compliance teams to design a contract that meets your unique needs.'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'Training'}
          headerDescription={'We will provide live training sessions for your teams to help onboard the team to the stack.'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'SOC 2 Report'}
          headerDescription={'We will provide your organization access to the Panfactum SOC 2 audit reports'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
        <PriceTableRow
          header={'BAA Agreement'}
          headerDescription={'We will sign a Business Associate Agreement to assist your organization achieve HIPPA compliance'}
          communityPlanContent={false}
          startupPlanContent={false}
          enterprisePlanContent={true}
        />
      </tbody>
    </table>
  )
}
