import { Agile, Eye, SecureWindow, Heart, FastUpCircle, Puzzle, MoneySquare, ClipboardCheck } from 'iconoir-react'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactElement } from 'react'
import Balancer from 'react-wrap-balancer'

import Carousel from '@/app/(web)/Carosel/Carousel'
import TextSlider from '@/app/(web)/TextSlider'
import PrettyBalancer from '@/components/ui/PrettyBalancer'

import { colors } from '../../../theme'

function LinkButton (props: {href: string, text: string, size?: 'large' | 'small'}) {
  const { href, text, size = 'small' } = props
  return (
    <Link
      href={href}
      className={`bg-primary text-white rounded-lg ${size === 'small' ? 'px-4 py-2 text-base sm:text-lg' : 'px-6 py-4 text-lg sm:text-xl'} font-semibold w-fit shadow-md hover:shadow-lg hover:-translate-y-1 transition-all ease-linear duration-100`}
    >
      {text}
    </Link>
  )
}

interface CalloutProps {
  title: string;
  text: string | ReactElement;
  buttonText: string;
  buttonHref: string;
}

function Callout (props: CalloutProps) {
  const { title, text, buttonText, buttonHref } = props
  return (
    <div
      className="flex flex-col w-[90%] sm:w-[45%] justify-between gap-2 px-4 py-4 bg-neutral border-solid border-gray-dark border-4 rounded-lg"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-xl sm:text-2xl">
          <PrettyBalancer>
            {title}
          </PrettyBalancer>
        </h2>
        <p
          className="mb-2 text-base sm:text-lg"
          style={{ textWrap: 'pretty' }}
        >
          <PrettyBalancer>
            {text}
          </PrettyBalancer>
        </p>
      </div>
      <LinkButton
        text={buttonText}
        href={buttonHref}
      />
    </div>
  )
}

interface PillarProps {
  icon: ReactElement
  title: string
  href: string
}

function Pillar (props: PillarProps) {
  const { icon, title, href } = props
  return (
    <Link
      href={href}
      className="flex text-black items-end gap-8 px-4 py-2 sm:py-4 bg-gray-dark rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all ease-linear duration-100 hover:cursor-pointer basis-[90%] sm:basis-[40%]"
    >
      {icon}
      <div className="text-lg sm:text-xl text font-semibold">
        {title}
      </div>
    </Link>
  )
}

function PageLink (props: { href: string, children: string }) {
  return (
    <Link
      className="underline text-primary font-medium"
      {...props}
    />
  )
}

export default function Page () {
  const lineColor = `${colors['gray-dark']}40`

  return (
    <div
      className="flex flex-col overflow-x-hidden"
      style={{
        background: `linear-gradient(${lineColor}, ${lineColor} 2%, transparent 2%, transparent 98%, ${lineColor} 98%), linear-gradient(90deg, ${lineColor}, ${lineColor} 2%, transparent 2%, transparent 98%, ${lineColor} 98%), linear-gradient(to bottom left, rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(to bottom right, rgba(0,0,0,0.2) 1px, transparent 1px)`,
        backgroundSize: '50px 50px, 50px 50px',
        backgroundPosition: '-2px -2px, -2px -2px, -2px -2px, -2px -2px'
      }}
    >
      <div >
        <div
          className="bg-neutral flex flex-col items-center px-8 py-6 sm:py-10"
          style={{
            background: `radial-gradient(circle, ${colors.neutral}99 70%, ${colors.primary}FF 300%)`
          }}
        >
          <Image
            alt="Panfactum Logo"
            src="/logo.svg"
            className={'text-primary bg-primary rounded-[125px] w-[60px] sm:w-[120px] h-[60px] sm:h-[120px]'}
            width={120}
            height={120}
          />
          <h1 className="text-4xl sm:text-7xl font-bold">
            Panfactum
          </h1>
          <div className="text-xl sm:text-3xl font-semibold flex flex-col items-center py-2">
            <TextSlider
              items={['Cloud Native', 'Infrastructure-as-Code', 'Open', 'Self-hosted', 'Production-hardened', 'Extensible']}
            />
            <div className={'text-center'}>system for platform engineering</div>
          </div>
          <div className="py-4">
            <LinkButton
              text={'Get Started'}
              href={'/docs/guides/getting-started/start-here'}
            />
          </div>
        </div>
      </div>
      <Carousel/>
      <div className="px-8 py-8 md:py-16">
        <div className="max-w-[1280px] mx-auto flex gap-6 sm:gap-10 flex-wrap justify-center">
          <Callout
            title={'Plug-and-Play'}
            text={(
              <>
                With 100+ ready-for-production infrastructure modules and a fully codified
                {' '}
                <PageLink
                  href={'https://devenv.sh/'}
                >
                  devenv
                </PageLink>
                ,
                {' '}
                <b>
                  get started in minutes
                </b>
                {' '}
                and be up and running in hours, not months.
              </>
            )}
            buttonText={'See the modules'}
            buttonHref={'/docs/reference/infrastructure-modules/overview'}
          />
          <Callout
            title={'Comprehensive Coverage'}
            text={(
              <>
                The Panfactum stack covers
                {' '}
                <b>everything</b>
                {' '}
                needed to build a world-class platform engineering practice
                in any software organization
                at any scale.
              </>
            )}
            buttonText={'Check out the Features'}
            buttonHref={'/docs/guides/bootstrapping/overview'}
          />
          <Callout
            title={'Step-by-Step Guides'}
            text={(
              <>
                <b>No experience or existing infrastructure needed.</b>
                {' '}
                Use our step-by-step guides and concept
                documentation for each component
                in the Panfactum stack.
              </>
            )}
            buttonText={'Use the bootstrapping guide'}
            buttonHref={'/docs/guides/bootstrapping/overview'}
          />
          <Callout
            title={'Open and Extensible'}
            text={(
              <>
                Eliminate vendor lock-in and friction. Panfactum is completely open and uses
                {' '}
                <b>only</b>
                {' '}
                open standards and technologies. Easily extend the stack to meet your organization&apos;s unique needs.
              </>
            )}
            buttonText={'See the code'}
            buttonHref={'https://github.com/Panfactum/stack'}
          />
          <Callout
            title={'Reduce platform costs by 90%'}
            text={(
              <>
                Stop paying the managed service tax. Use automated resource-rightsizing, spot instances,
                cost-optimized storage, and more on
                {' '}
                <b>every</b>
                {' '}
                workload.
              </>
            )}
            buttonText={'Calculate your savings'}
            buttonHref={'.'}
          />
          <Callout
            title={'Immediate Integration'}
            text={(
              <>
                No more flaky developer environments. Allow all developers to hot-reload code and infrastructure
                changes to
                {' '}
                <b>exact</b>
                {' '}
                copies of production.
              </>
            )}
            buttonText={'Watch the demo'}
            buttonHref={'.'}
          />
          <Callout
            title={'Hyper-optimized CI/CD'}
            text={(
              <>
                Transform the way you build and ship code with self-hosted pipelines that are 10x more performant
                and resilient than shared CI runners like Github Actions.
              </>
            )}
            buttonText={'See the benchmarks'}
            buttonHref={'.'}
          />
          <Callout
            title={'Zero-Trust Architecture'}
            text={(
              <>
                Protect your system from threats inside and out. SSO on everything. Encryption everywhere. No static
                credentials. Advanced runtime firewalling and alerting.
              </>
            )}
            buttonText={'Learn more'}
            buttonHref={'.'}
          />
          <Callout
            title={'Compliance Baked-in'}
            text={(
              <>
                Avoid expensive remediation by starting compliant with all major IT standards: SOC 2, ISO 27001,
                HITRUST, etc.
              </>
            )}
            buttonText={'Learn more'}
            buttonHref={'.'}
          />

          <Callout
            title={'Resiliency and Disaster Recovery'}
            text={(
              <>
                Maximize your uptime and data durability with multi-zone resiliency, automated rollbacks, multi-site
                backup. and one-click restores.
              </>
            )}
            buttonText={'Learn more'}
            buttonHref={'.'}
          />
        </div>

      </div>

      <div
        className="flex flex-col px-8 py-8 md:py-16 gap-4 border-y-4 border-y-solid border-y-primary"
        style={{
          background: `radial-gradient(circle, ${colors.neutral}99 70%, ${colors.primary}FF 300%)`
        }}
      >
        <h2 className="text-3xl sm:text-4xl text-center w-full">
          Benchmark your Platform Engineering Practice
        </h2>
        <div className="max-w-4xl mx-auto flex flex-col gap-6 items-center">

          <h3 className="text-lg sm:text-xl font-medium text-center">
            <PrettyBalancer>
              The Panfactum framework measures platform engineering effectiveness across eight core
              pillars.
            </PrettyBalancer>
          </h3>

          <div className="flex flex-wrap gap-4 justify-center">
            <Pillar
              icon={(
                <Agile
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Automation'}
              href={'/docs/framework/pillars/automation'}
            />
            <Pillar
              icon={(
                <Eye
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Observability'}
              href={'/docs/framework/pillars/observability'}
            />
            <Pillar
              icon={(
                <SecureWindow
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Security'}
              href={'/docs/framework/pillars/security'}
            />

            <Pillar
              icon={(
                <Heart
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Resiliency'}
              href={'/docs/framework/pillars/resiliency'}
            />
            <Pillar
              icon={(
                <FastUpCircle
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Performance'}
              href={'/docs/framework/pillars/performance'}
            />
            <Pillar
              icon={(
                <Puzzle
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Immediate Integration'}
              href={'/docs/framework/pillars/immediate-integration'}
            />
            <Pillar
              icon={(
                <MoneySquare
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Efficiency'}
              href={'/docs/framework/pillars/efficiency'}
            />
            <Pillar
              icon={(
                <ClipboardCheck
                  strokeWidth={2}
                  width={'2rem'}
                  height={'2rem'}
                />
              )}
              title={'Coordination'}
              href={'/docs/framework/pillars/coordination'}
            />
          </div>

          <LinkButton
            size={'large'}
            href={'/docs/framework/framework/overview'}
            text={'Learn more about the framework'}
          />
        </div>

      </div>

      <div className="px-8 py-8 md:py-16 gap-4">
        <div className="flex flex-col max-w-6xl mx-auto gap-8 items-center">
          <h2 className="text-3xl sm:text-4xl text-center w-full">
            Partner Network
          </h2>
          <div className="flex flex-wrap justify-center gap-10">
            <div className="flex flex-col gap-4 items-center min-w-[90%] sm:min-w-[45%] basis-[90%] sm:basis-[45%] bg-neutral p-4 rounded-xl justify-between border-solid border-gray-dark border-4">
              <p className="text-lg sm:text-xl text-center">
                <Balancer>
                  Want help with deploying the stack and training your team?
                </Balancer>
              </p>

              <LinkButton
                href={'.'}
                text={'Find a Partner'}
              />
            </div>
            <div className="flex flex-col gap-4 items-center min-w-[90%] sm:min-w-[45%] basis-[90%] sm:basis-[45%] bg-neutral p-4 rounded-xl justify-between border-solid border-gray-dark border-4">
              <p className="text-lg sm:text-xl text-center">
                <Balancer>
                  Are you an professional services or managed services provider?
                </Balancer>
              </p>

              <LinkButton
                href={'.'}
                text={'Become a Partner'}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
