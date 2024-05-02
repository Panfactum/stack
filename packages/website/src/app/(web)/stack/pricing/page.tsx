import Link from 'next/link'
import React from 'react'
import Balancer from 'react-wrap-balancer'

import FAQ from '@/app/(web)/stack/pricing/components/FAQ'
import PriceTable from '@/app/(web)/stack/pricing/components/PriceTable'
import { discordServerLink } from '@/app/vars'
import PrettyBalancer from '@/components/ui/PrettyBalancer'

export default function Page () {
  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto pt-12 pb-20 min-h-[90vh] px-4">
      <h1 className="w-full text-3xl sm:text-5xl mb-3 text-center">
        Panfactum Stack Pricing
      </h1>
      <p className="w-full mb-3 text-center italic sm:text-lg">
        <Balancer>
          Questions? Reach out
          {' '}
          <Link
            href={'/stack/pricing/contact'}
            className="text-primary underline hover:cursor-pointer"
          >
            here!
          </Link>

        </Balancer>
      </p>
      <div className="overflow-x-auto w-full py-2">
        <PriceTable/>
      </div>
      <p className="w-full mb-3 italic">
        Licenses are provided only to end-users of the Panfactum stack.
        Individual licenses
        {' '}
        <b>may not</b>
        {' '}
        be shared across multiple end-users.
        An end-user is any organization whose employees, partners, or contractors directly interact
        with infrastructure provisioned by Panfactum modules. For example, a managed service provider
        may not use a single Panfactum license for each of their customers; a unique license must be
        purchased for each customer.
      </p>
      <h2 className="w-full text-3xl mt-8 mb-3 text-center">
        Available Discounts
      </h2>
      <div className="flex gap-4 flex-wrap justify-between">
        <div className="flex flex-col justify-between basis-[100%] sm:basis-[30%] bg-neutral rounded-xl p-3">
          <div className="flex flex-col">
            <h3 className="text-xl font-medium tracking-wide">Annual Payment</h3>
            <PrettyBalancer>
              <p>
                <b>15% off</b>
                {' '}
                for customers who pay annually.
              </p>
            </PrettyBalancer>

          </div>
          <div>
            <em>Does not include one-time services.</em>
          </div>
        </div>
        <div className="flex flex-col basis-[100%] sm:basis-[30%] bg-neutral rounded-xl p-3">
          <h3 className="text-xl font-medium tracking-wide">Panfactum Partners</h3>
          <p>
            Up to
            {' '}
            <b>50% off</b>
            {' '}
            for service providers implementing the Panfactum Stack for their clients. Learn more.
          </p>
        </div>
        <div className="flex flex-col justify-between basis-[100%] sm:basis-[30%] bg-neutral rounded-xl p-3">
          <div className="flex flex-col">
            <h3 className="text-xl font-medium tracking-wide">Non-profits</h3>
            <PrettyBalancer>
              <p>
                <b>50% off</b>
                {' '}
                for registered non-profit organizations.
              </p>
            </PrettyBalancer>
          </div>
          <div>
            <em>Does not include one-time services.</em>
          </div>
        </div>
      </div>
      <h2 className="w-full text-3xl mt-16 mb-3 text-center">
        Frequently Asked Questions
      </h2>
      <FAQ
        title={'Do you offer trials?'}
        answerSections={[
          'Any organization of any size is licensed to use software included the community plan to create proofs-of-concept free of charge and without needing to register with Panfactum.',
          <>
            A
            {' '}
            <em>proof-of-concept</em>
            {' '}
            is a deployment of Panfactum infrastructure modules used to inform a purchasing decision. Proof-of-concept
            infrastructure may only be run continuously for
            {' '}
            <b>30 days.</b>
          </>
        ]}
      />
      <FAQ
        title={'Why do you have revenue restrictions?'}
        answerSections={[
          'When we set out to build the stack, we wanted to accomplish three key goals:',
          <ul
            key={'1'}
            className="m-0"
          >
            <li>Develop in the open so anyone can inspect and / or extend the Stack</li>
            <li>Avoid gating useful features behind cost-prohibitive licenses</li>
            <li>Allow for complete flexibility of deployment scenarios without fear of unit-based pricing / limits</li>
          </ul>,
          'While we believe strongly that these goals are best for our users, they do limit what we can do to properly fund ongoing work at Panfactum.',
          'In other words, we still need a sustainable business model to ensure that we never have to change our license terms in the future once you are already running the Stack.',
          'Revenue-driven tiering is one such model that allows us to continue to serve small and large users alike. Many infrastructure companies such as Docker, Buoyant, etc. have successfully demonstrated the win-win nature of this approach.'
        ]}
      />
      <FAQ
        title={'Does the Panfactum Stack require dedicated DevOps / platform engineers to operate?'}
        answerSections={[
          'No. If you are familiar with building and shipping code, you can easily deploy and manage the Panfactum Stack.',
          <>
            While the Stack contains functionality that would only normally be possible with dedicated infrastructure
            teams, we provide
            {' '}
            <Link
              href={'/docs/guides/bootstrapping/overview'}
              className="text-primary underline hover:cursor-pointer"
            >
              detailed step-by-step guides
            </Link>
            {' '}
            that allow organizations to manage the system for less than 4 person-hours / month.
          </>,
          <>
            Moreover, we have an
            {' '}
            <Link
              href={discordServerLink}
              className="text-primary underline hover:cursor-pointer"
            >
              active community
            </Link>
            {' '}
            of users who can help answer questions and provide support.
          </>,
          <>
            For organizations with the resources for dedicated teams, the Stack frees engineers to
            work on more interesting and challenging problems that are unique to your organization.
          </>
        ]}
      />
      <FAQ
        title={'How do you track licenses?'}
        answerSections={[
          <>
            Unlike most managed service providers, we do
            {' '}
            <b>not</b>
            {' '}
            run any telemetry in your live infrastructure. Moreover, your production systems
            {' '}
            <b>never</b>
            {' '}
            connect to ours. Your data stays inside your platform, even if you run our infrastructure modules.
          </>,
          'Instead, we perform license checks when you boot up the Panfactum local development environment and when you download and deploy the source code for Panfactum infrastructure modules.'
        ]}
      />
      <FAQ
        title={'Do Panfactum employees have access to my infrastructure or data?'}
        answerSections={[
          <>
            Unlike most managed service providers, we
            {' '}
            <b>never</b>
            {' '}
            have access to any of your live systems unless you specifically grant it.
          </>,
          <>
            Enterprise customers may choose to grant their Panfactum engineers access to systems to aid in debugging.
            All Panfactum support employees go through standard background check and training procedures in order to
            protect sensitive customer data and system.
          </>
        ]}
      />
      <FAQ
        title={'What happens to my infrastructure if I want to stop licensing Panfactum?'}
        answerSections={[
          <>
            The Panfactum stack is built exclusively on open source and open standards. The only proprietary components
            are the Panfactum code and documentation that enable easy, secure, and highly available deployments of these
            systems. If you are unhappy with the service we provide, you are
            {' '}
            <b>not</b>
            {' '}
            locked-in to any proprietary systems.
          </>,
          <>
            Just to be sure, we grant a
            {' '}
            <b>free, perpetual, irrevocable</b>
            {' '}
            license to continue using the
            {' '}
            <b>current and prior stable releases</b>
            {' '}
            of the Panfactum stack at the time that you cancel your license.
          </>,
          <>
            <em>This is only available to customers after a three month waiting period to prevent abuse.</em>
          </>
        ]}
      />
      <FAQ
        title={'How will the health of Panfactum (the business) impact my infrastructure?'}
        answerSections={[
          <>
            Panfactum is bootstrapped, entirely employee owned, and has been profitable from day zero. Unlike typical
            venture-backed companies, we have designed to business to thrive into perpetuity without ever needing to
            change our existing service offerings, IPO, or sell to an acquirer.
          </>,
          <>
            In the unlikely scenario that the entire Panfactum team is taken out by cloud service assassins, your
            infrastructure will continue to operate as normal. Understandably, you might want to stop licensing from us
            as we would be unable to produce further updates. See the above question for more information.
          </>
        ]}
      />
      <FAQ
        title={'Is Panfactum is production-ready?'}
        answerSections={[
          <>
            Yes. While Panfactum (the company) was formally launched in 2023, we have been providing iterations of the
            Stack to companies for nearly a decade. We have honed the lessons learned across dozens of deployment
            scenarios into the Stack you see today.
          </>,
          <>
            We run our own production infrastructure directly on the bleeding-edge Stack. You can see the exact
            deployment code
            {' '}
            <Link
              href={'https://github.com/Panfactum/stack/tree/main/packages/reference'}
              className="text-primary underline hover:cursor-pointer"
            >
              here
            </Link>
            {' '}
            and even connect to it yourself
            {' '}
            <Link
              href={'/stack/demo'}
              className="text-primary underline hover:cursor-pointer"
            >
              here.
            </Link>
          </>,
          <>
            If you would like to connect with an existing user of the Stack, get in touch or reach out directly on our
            {' '}
            <Link
              href={discordServerLink}
              className="text-primary underline hover:cursor-pointer"
            >
              community forum.
            </Link>
          </>
        ]}
      />
      <FAQ
        title={'How do you secure the Panfactum software supply chain?'}
        answerSections={[
          <>
            We only use open-source or source-available tooling and pin all downloads to specific content hashes.
            Additionally, the stack itself is developed completely in the open with a full audit trail of any
            changes.
          </>,
          <>
            We have continuous monitoring deployed to identify CVEs in any of our included third-party dependencies, and
            we run all infrastructure components in test environments before updates are distributed via a release
            channel to identify any anomalous behavior.
          </>,
          <>
            The stack itself contains deny-by-default network policies that prevent data exfiltration should any
            malicious program escape detection during our sandbox testing.
          </>,
          <>
            Finally, all commits to the Panfactum stack release channels are signed by a Panfactum employee and require
            the approval of a Panfactum executive before being made public.
          </>,
          <>
            If security issues are detected, we have a standard process for
            {' '}
            <Link
              href={'https://github.com/Panfactum/stack/security/advisories/new'}
              className="text-primary underline hover:cursor-pointer"
            >
              securely notifying Panfactum maintainers.
            </Link>
          </>
        ]}
      />
      <FAQ
        title={'Can I lock-in long-term pricing?'}
        answerSections={[
          <>Contract terms are available when designing MSAs under the Enterprise plan.</>
        ]}
      />
      <FAQ
        title={'What are the available payment terms and methods?'}
        answerSections={[
          <>For Startup customers, we charge an on-file credit card once per month.</>,
          <>
            For Enterprise customers, we can accept payment via all standard methods and terms that we align on when
            crafting the MSA.
          </>
        ]}
      />
      <FAQ
        title={'Can I self-service my purchase of a Panfactum license?'}
        answerSections={[
          <>
            Choosing a system to run your infrastructure on is a huge decision. In order to provide the best possible
            support and experience, we do not serve every potential customer. Sometimes we do not have the support
            staff. Other times a customer&apos;s unique situation is not a great fit for the Stack.
          </>,
          <>
            Taking a few minutes to connect and validate your plans will ensure your rollout of the Panfactum Stack goes
            smoothly.
          </>
        ]}
      />
      <FAQ
        title={'How is the data on the purchase form used?'}
        answerSections={[
          <>
            The contact forms on our purchase page deposit the data directly into our CRM. We then get to work setting
            up an initial call to answer any questions, schedule any demos, and work out any details for the deal.
          </>,
          <>
            We do
            {' '}
            <b>not</b>
            {' '}
            use this data to sign you up for marketing emails nor do we ever sell this information to third-parties.
          </>
        ]}
      />
      <h2 className="w-full text-3xl mt-16 mb-3 text-center">
        Ready to Deploy?
      </h2>
      <p className="text-lg text-center mb-3">
        The first step is to connect with us so we can issue you a license!
      </p>
      <Link
        href={'/stack/pricing/contact'}
        className="bg-primary text-white py-1 px-4 rounded w-fit mx-auto text-2xl"
      >
        Connect
      </Link>
    </div>
  )
}
