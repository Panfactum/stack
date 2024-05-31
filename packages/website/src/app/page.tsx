import { Agile, Eye, SecureWindow, Heart, FastUpCircle, Puzzle, MoneySquare, ClipboardCheck } from 'iconoir-react'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactElement } from 'react'

import Carousel from '@/app/Carosel/Carousel'
import TextSlider from '@/app/TextSlider'
import Balancer from '@/components/ui/Balancer'
import PrettyBalancer from '@/components/ui/PrettyBalancer'
import VersionedDocsLink from '@/components/ui/VersionedDocsLink'
import { discordServerLink, isValidVersionSlug } from '@/lib/constants'

import { Gears, Gears2, Gears3 } from './Gears'
import discordIconImg from './discord.svg'
import { colors } from '../../theme'

function LinkButton (props: {href: string, children: string | ReactElement, size?: 'large' | 'small', color?: 'blue' | 'grey' | 'white'}) {
  const { href, children, size = 'small', color = 'blue' } = props
  const className = `${color === 'blue' ? 'bg-primary text-white' : color === 'grey' ? 'bg-secondary text-white' : 'bg-white text-primary'} rounded-lg ${size === 'small' ? 'px-4 py-2 text-base sm:text-lg' : 'px-6 py-4 text-lg sm:text-xl'} font-medium w-fit shadow-md hover:shadow-lg hover:-translate-y-1 transition-all ease-linear duration-100 flex items-center text-center`

  // Ensures that we use the appropriate version for docs links
  if (href.startsWith('/')) {
    const segments = href.split('/')
    if (segments.length >= 3 && segments[1] === 'docs' && isValidVersionSlug(segments[2])) {
      return (
        <VersionedDocsLink
          path={`/${segments.slice(3).join('/')}`}
          className={className}
        >
          {children}
        </VersionedDocsLink>
      )
    }
  }

  return (
    <Link
      href={href}
      className={className}
    >
      {children}
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
      style={{
        background: `radial-gradient(circle, ${colors.neutral}BB 80%, ${colors.primary}FF 300%)`
      }}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-xl sm:text-2xl font-medium">
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
        href={buttonHref}
      >
        <Balancer>
          {buttonText}
        </Balancer>
      </LinkButton>
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
      <div className="text-lg sm:text-xl text font-medium">
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
          className="bg-neutral flex flex-col items-center px-8 pt-6 sm:pt-10 pb-4"
          style={{
            background: `radial-gradient(circle, ${colors.neutral}AA 70%, ${colors.primary}FF 300%)`
          }}
        >
          <Image
            alt="Panfactum Logo"
            src="/logo.svg"
            className={'text-primary bg-primary rounded-[125px] w-[60px] sm:w-[120px] h-[60px] sm:h-[120px]'}
            width={120}
            height={120}
          />
          <h1 className="text-4xl sm:text-7xl font-semibold">
            Panfactum
          </h1>
          <div className="text-xl sm:text-3xl font-medium flex flex-col items-center py-2">
            <TextSlider
              items={['Cloud Native', 'Infrastructure-as-Code', 'Open', 'Self-hosted', 'Production-hardened', 'Extensible']}
            />
            <div className={'text-center'}>system for platform engineering</div>
          </div>
          <div className="py-4 flex gap-4 flex-wrap">
            <LinkButton
              href={'/docs/edge/guides/getting-started/start-here'}
            >
              Get Started
            </LinkButton>
            <LinkButton
              href={discordServerLink}
              color='grey'
            >
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block">Connect</span>
                <Image
                  height={30}
                  width={30}
                  src={discordIconImg as string}
                  alt={'Join the discord server'}
                  className="h-[25px] sm:h-[30px] w-[25px] sm:w-[30px]"
                />
              </div>
            </LinkButton>
          </div>
        </div>
      </div>
      <Carousel/>
      <div
        className="px-8 py-6 sm:py-12"
      >
        <div
          className="max-w-[1280px] mx-auto text-center bg-neutral border-gray-dark border-solid border-4 rounded-xl mb-6 px-6 py-6 flex flex-wrap lg:flex-nowrap items-center gap-5"
          style={{
            background: `radial-gradient(ellipse, ${colors.neutral}99 70%, ${colors.primary}FF 300%)`
          }}
        >
          <span className="hidden lg:inline">
            <Gears/>
          </span>
          <span className="lg:hidden mx-auto">
            <Gears3/>
          </span>
          <div className="flex flex-col gap-4 items-center">

            <h1 className="font-semibold text-3xl sm:text-4xl">
              The Stack
            </h1>
            <p className="text-lg sm:text-xl">
              <Balancer>
                The
                {' '}
                <em>Panfactum Stack</em>
                {' '}
                is an integrated set of OpenTofu (Terraform) modules and local tooling aimed
                at providing the best experience for building, deploying, and managing software on AWS
                and Kubernetes.
              </Balancer>
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <LinkButton
                href={'/stack/features'}
                color={'blue'}
              >
                Features
              </LinkButton>
              <LinkButton
                href={'/stack/pricing'}
                color='grey'
              >
                Pricing
              </LinkButton>
            </div>

          </div>
          <span className="hidden lg:inline">
            <Gears2/>
          </span>
        </div>
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
            buttonHref={'/docs/edge/reference/infrastructure-modules/overview'}
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
            buttonHref={'/docs/edge/guides/bootstrapping/overview'}
          />
          <Callout
            title={'Deploy on your Infrastructure'}
            text={(
              <>
                Run your entire platform from the comfort and safety of your own AWS infrastructure.
                The stack does not create unnecessary abstractions or depend on any external management systems.
              </>
            )}
            buttonText={'Connect to a demo instance'}
            buttonHref={'/stack/demo/live'}
          />
          <Callout
            title={'Open and Extensible'}
            text={(
              <>
                Eliminate vendor lock-in and friction. Panfactum is source-available and uses
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
            buttonHref={'/stack/savings'}
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
        className="flex flex-col px-8 py-8 sm:py-12 gap-4 border-y-4 border-y-solid border-y-primary"
        style={{
          background: `radial-gradient(circle, ${colors.neutral}99 70%, ${colors.primary}FF 300%)`
        }}
      >
        <h2 className="text-3xl sm:text-4xl text-center w-full font-semibold">
          <Balancer>
            Benchmark your Platform Engineering Practice
          </Balancer>
        </h2>
        <div className="max-w-4xl mx-auto flex flex-col gap-6 items-center">

          <h3 className="text-lg sm:text-xl font-normal text-center w-full">
            <PrettyBalancer>
              The Panfactum framework measures platform engineering effectiveness with 250+ measures across eight core
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
          >
            Learn more about the framework
          </LinkButton>
        </div>

      </div>

      <div className="px-8 py-8 md:py-16 gap-4">
        <div className="flex flex-col max-w-6xl mx-auto gap-8 items-center">
          <h2 className="text-3xl sm:text-4xl text-center w-full font-semibold">
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
              >
                Find a Partner
              </LinkButton>
            </div>
            <div className="flex flex-col gap-4 items-center min-w-[90%] sm:min-w-[45%] basis-[90%] sm:basis-[45%] bg-neutral p-4 rounded-xl justify-between border-solid border-gray-dark border-4">
              <p className="text-lg sm:text-xl text-center">
                <Balancer>
                  Are you an professional services or managed services provider?
                </Balancer>
              </p>

              <LinkButton
                href={'.'}
              >
                Become a Partner
              </LinkButton>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
