import { Accordion } from "@kobalte/core/accordion";
import { FiPlusCircle } from "solid-icons/fi";
import type { Component, ParentComponent } from "solid-js";

export const HowSectionExpandables: Component = () => {
  return (
    <div class="w-full">
      <Accordion
        class="flex w-full max-w-screen-lg flex-col gap-5"
        collapsible={true}
      >
        <HowSectionExpandable title="Total Platform Management" id="tpm">
          <p>
            We know you want to focus on delivering value, not toiling with
            cloud infrastructure. Our engineers ensure that you will never need
            to worry about infrastructure again.
          </p>
          <p>
            We tackle <b>all phases</b> of your cloud infrastructure lifecycle:
            setup, migration, monitoring, incident response, proactive
            maintenance, upgrades, and de-provisioning.
          </p>
          <p>
            <b>And we don't stop there.</b> We take the lead implementing
            best-in-class patterns for each and every one of your custom
            workloads: CI/CD, high availability, disaster recovery,
            observability, performance tuning, security, compliance, etc.{" "}
          </p>
        </HowSectionExpandable>
        <HowSectionExpandable title="Unrivaled Speed" id="speed">
          <p>
            Don't let cloud complexity rate-limit your growth. By leveraging our{" "}
            <a href="/" class="cursor-pointer">
              Panfactum framework
            </a>
            , we accomplish in <b>hours</b> what takes other teams months.
          </p>
          <p>
            While your competition is stuck toiling with the cloud basics, your
            dedicated Panfactum engineer will provide an infrastructure platform
            that{" "}
            <b>unlocks new capabilities and accelerates product development.</b>
          </p>
        </HowSectionExpandable>

        <HowSectionExpandable title="24/7/365 Monitoring & Triaging" id="24/7">
          <p>
            Nothing kills momentum faster than production emergencies. Our
            on-call SRE teams continually monitor your systems and address
            infrastructure issues{" "}
            <b>before they reach your users and developers.</b>
          </p>
          <p>
            In addition, your dedicated engineer will set up advanced detection
            and automated rollback systems to{" "}
            <b>proactively mitigate application bugs.</b> When bugs do slip
            through the cracks, our SREs will always be available. We will work
            alongside your application developers to leverage our advanced
            observability platform to identify and correct the issue in record
            time.
          </p>
        </HowSectionExpandable>

        <HowSectionExpandable
          title="Unlimited Platform Customizations"
          id="custom"
        >
          <p>
            Every company eventually feels limited by its cloud platform &mdash;
            often hitting obstacles at the most inconvenient times. Panfactum
            stands aparts as a cloud framework that was explicitly designed to
            be <b>customized and extended</b> for your team's unique needs.
          </p>
          <p>
            Unlike other platforms that trap you in their rigid box, we've
            specifically trained our engineers in extending the Panfactum
            framework for every client install. Whether you have a simple CRUD
            application or a complex agentic AI solution, our engineers can
            optimize Panfactum to meet your cloud needs.
          </p>
        </HowSectionExpandable>
        <HowSectionExpandable title="Embedded Support & Training" id="support">
          <p>
            <b>Collaborate without limits.</b> Our Panfactum engineer will embed
            themselves directly in your team's communication tools such as Slack
            and build long-term working relationships with every member of your
            team.
          </p>
          <p>
            Lean on our engineers to upskill your existing team members, provide
            expert architectural guidance, and benchmark your system designs
            against what works best for other Panfactum clients.
          </p>
          <p>
            100% of the infrastructure-as-code we build lives in your team's
            code repositories. Unlike legacy agencies, we've designed our
            systems to allow your team to collaborate and self-service on the
            systems we deploy and maintain for you.
          </p>
        </HowSectionExpandable>
        <HowSectionExpandable
          title="Backed by World-leading Experts"
          id="experts"
        >
          <p>
            Don't settle for a single-point of failure in your mission-critical
            cloud deployments.
          </p>
          <p>
            Your dedicated engineer is backed by a{" "}
            <b>team of world-leading cloud infrastructure experts</b> and the
            creators of the Panfactum framework. As a result, you get immediate
            access to battle-hardened patterns and practices we've refined
            across hundreds of client deployments.
          </p>
        </HowSectionExpandable>
      </Accordion>
    </div>
  );
};

const HowSectionExpandable: ParentComponent<{ title: string; id: string }> = (
  props,
) => {
  return (
    <Accordion.Item
      value={props.id}
      class="rounded-xl border-2 border-gray-dark-mode-300  px-4 py-2"
    >
      <Accordion.Header class="[&[data-expanded]_svg]:rotate-45">
        <Accordion.Trigger class="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-xl font-semibold">
          {props.title}
          <FiPlusCircle size={32} class="text-brand-600 transition-all" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content class="flex animate-kobalte-collapsible-up flex-col gap-4 overflow-hidden text-gray-dark-mode-700 data-[expanded]:animate-kobalte-collapsible-down [&_a]:underline [&_a]:hover:cursor-pointer">
        {props.children}
      </Accordion.Content>
    </Accordion.Item>
  );
};
