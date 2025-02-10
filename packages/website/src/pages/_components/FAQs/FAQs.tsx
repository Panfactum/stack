import { Accordion } from "@kobalte/core/accordion"
import type { Component } from "solid-js"

import './animation.css'
import FAQItem from "@/pages/_components/FAQs/FAQItem.tsx";

const FAQS: Component = () => {
  return (
    <Accordion class="w-full max-w-screen-lg" multiple={true}>
      <FAQItem title={"Is Panfactum right for me?"} id={"right-for-me"}>
        An ideal Panfactum user generally meets the following criteria:
        <ul class="flex list-inside list-disc flex-col gap-4">
          <li>
            Deploys on AWS and uses (or plans to use) containerization
          </li>
          <li>
            Plans on spending at least $15,000 on infrastructure and developer tooling in the next 12 months
          </li>
          <li>
            Has at least one software engineer / developer on staff
          </li>
        </ul>
        If you fit these criteria, using the Panfactum framework will improve time-to-value and reduce the total cost of ownership of your
        infrastructure. Our support plans make that a guarantee.
      </FAQItem>
      <FAQItem title={"If Panfactum is free, why should I get a support plan?"} id={"why-support"}>
        <p>
          Our aim is to provide end-to-end support at less than 25% the current hourly market
          rate for
          infrastructure experts. We absolve you of the risk and challenge of meeting that bar.
        </p>
        <p>
          These savings allow you and your organization to focus on more interesting problems than optimizing, upgrading, and maintaining your infrastructure.
          Leave that to us, and we can guarantee it is done better, faster, and cheaper.
        </p>
        <p>
          That said, if you're an engineer who thinks you can support Panfactum better than us, we'd love to hire you.
          Seriously!
          Get in touch at jack@panfactum.com with the subject line "Better than You".
        </p>
      </FAQItem>

      <FAQItem title={"Does my support plan need to cover all workloads deployed on Panfactum?"} id={"coverage"}>
        <p>
          Yes. When we proactively apply updates your foundational infrastructure, we also need to update the
          infrastructure-as-code your workloads use. If those versions are not in-sync, then instability,
          security problems, or even outages can occur. As a result, our support plans must cover all your Panfactum systems for
          us to achieve our contractual obligations to you.
        </p>
        <p>
          For simple workloads, this can sometimes cause our plan costs to be higher than necessary. Please highlight
          that when connecting with us, so that we can devise support plan pricing that makes sense for your use case.
        </p>
      </FAQItem>
      <FAQItem title={"Do you replace DevOps / platform engineers?"} id={"replace-engineers"}>
        <p>
          If your organization is just starting out in the cloud, our support plans can replace
          the need to hire infrastructure experts on day one.
        </p>
        <p>
          That said, our platform is also designed to be extended by your engineers to meet your organization's
          unique needs. Our support plans are primarily focused on cutting the costs of the undifferentiated toil such as upgrade
          cycles and ongoing maintenance.
        </p>
        <p>
          This allows your DevOps and platform engineers to work on problems that improve productivity and efficiency
          even further rather than just worrying about keeping the foundational infrastructure running.
        </p>
      </FAQItem>
      <FAQItem title={"Can we (continue to) customize Panfactum under a support plan?"} id={"customize"}>
        <p>
          Absolutely! Panfactum is designed specifically to provide sane out-of-the-box defaults while also ensuring
          you always have the ability to customize your infrastructure unlike most other managed services
        </p>
        <p>
          Our support plans are primarily focused on cutting the costs of the undifferentiated toil such as upgrade
          cycles and ongoing maintenance. If anything, this allows you to have more time to customize Panfactum to your
          organization's unique needs.
        </p>
        <p>
          As you work on bespoke infrastructure components, our engineers will also provide support and guidance
          to ensure that you meet your goals.
        </p>
      </FAQItem>
      <FAQItem title={"Are the savings guaranteed?"} id={"guaranteed-savings"}>
        <p>
          Before signing any contracts, we conduct a free assessment to pinpoint exactly how much we can save you and
          when
          you
          can expect those savings (generally within 45 days).
        </p>
        <p>
          If we miss those targets, we will pay the difference. In any case, you are guaranteed to save money.
        </p>
      </FAQItem>
      <FAQItem title={"How does Panfactum achieve such high infrastructure savings?"} id={"how-savings"}>
        <p>
          It's no secret that managed service providers like AWS achieve outsized margins on the systems they sell
          to you.
          Historically, this used to be acceptable as there were no alternatives that also made managing your infrastructure
          easy.
        </p>
        <p>
          Panfactum has stepped up to fill that void. We integrate 100s of open-source projects to provide
          easy-to-use, feature-compatible
          alternatives to expensive managed services and return the savings directly to you.
        </p>
        <p>
          In addition, we have optimized our systems to run on discounted compute provided by AWS. This unlocks
          an additional 70% savings over the default options that AWS pushes you towards without any loss in
          performance
          or functionality.
        </p>
        <p>
          Finally, all of our systems come with automatic autoscaling out-of-the-box to ensure you are never paying for
          unused resources.
        </p>
        <p>
          We have left no stone unturned and can confidently say Panfactum provides the most cost effective way to run
          workloads in the cloud. Our support plans make that a guarantee.
        </p>
      </FAQItem>
      <FAQItem title={"Will you migrate our existing workloads and infrastructure-as-code onto Panfactum?"} id={"migrate"}>
        <p>
          Yes! We take complete ownership over the migration process and in the vast majority of cases can even achieve
          a migration with zero downtime. This process normally takes around 30 days.
        </p>
        <p>
          That includes containerizing your workloads (if they aren't already), developing the production-ready
          infrastructure-as-code
          for them, deploying them to your Panfactum clusters, and hooking up end-to-end CI/CD pipelines.
        </p>
        <p>
          If you already have a paradigm for managing infrastructure via infrastructure-as-code, we do require
          that you migrate to our open-source paradigm using{" "}<a href={"https://opentofu.org/"}>OpenTofu</a>{" "}and {" "}<a href="https://terragrunt.gruntwork.io/">Terragrunt</a>{" "}
          so that we can ensure your success. Most of the times, we can migrate your infrastructure-as-code to our patterns
          even if doesn't manage Panfactum infrastructure. That enables you to have a single way of managing infrastructure
          across your organization (and often cuts costs as well).
        </p>
      </FAQItem>
      <FAQItem title={"How often is my infrastructure upgraded?"} id={"frequency"}>
        <p>
          We pin users to our stable release channels (unless you request otherwise). We create new stable releases at
          the same cadence
          as Kubernetes version releases to ensure that your infrastructure never falls behind. Currently, that means
          a new release every four to six months.
        </p>
        <p>
          We will reach out a month in advance of every upgrade so that we can collaborate on stability testing
          as each new release can contain significant changes, oftentimes driven by the projects we integrate.
        </p>
        <p>
          Occasionally, we will find bugs or security issues in our stable releases our upstream projects. We patch those in a backwards
          compatible manner and deploy those updates immediately to your infrastructure to minimize any negative impact.
        </p>
      </FAQItem>
      <FAQItem title={"Do you provide SLAs for deployed infrastructure?"} id={"slas"}>
        <p>
          Yes. For each workload, we work with you to decide whether a 99.9%, 99.99%, or 99.999% uptime target is
          desired (higher targets
          mean higher compute costs). Whatever the target, if we miss it, we will refund that entire month's support costs.
        </p>
      </FAQItem>
      <FAQItem title={"Do you provide audit / compliance support?"} id={"audit"}>
        <p>
          Yes. Our comprehensive documentation and hardened infrastructure-as-code setup enables customers to quickly
          and easily achieve certifications such as SOC 2 Type II, HITRUST, and ISO 27001.
        </p>
      </FAQItem>
      <FAQItem title={"Do you offer a free trial period?"} id={"trial"}>
        <p>
          If you are not completely satisfied after the first 45 days of the engagement, we will refund <em>all</em> money
          paid with no questions asked. Our aim is to make using Panfactum risk-free.
        </p>
      </FAQItem>
      <FAQItem title={"Who from Panfactum provides the infrastructure support?"} id={"solutions-engineer"}>
        <p>
          You will get a dedicated solutions engineer who will learn your systems inside and out. No more sending
          support tickets into the void or escalating support tiers until you get a real engineer.
          Your solutions engineer will be your single point-of-contact for all your infrastructure needs. If you have
          a supported instant messaging system (e.g., Slack), this engineer will be available directly in your
          workspace.
        </p>
        <p>
          Each solutions engineer is backed by an entire organization of world-leading experts in the technologies
          integrated into the Panfactum framework. This enables us to provide round-the-clock support
          and guaranteed resolution times{" "}<em>any</em>{" "}problem that you might encounter (see plan pricing
          details above).
        </p>
      </FAQItem>
      <FAQItem title={"Who is responsible for non-Panfactum infrastructure?"} id={"non-panfactum"}>
        <p>
          If the workload is deployed on a Panfactum Kubernetes cluster, we provide end-to-end support.
        </p>
        <p>
          If the workload interacts with workloads on Panfactum, we will handle the integration on the Panfactum side.
        </p>
        <p>
          If the workload is deployed outside of a Panfactum cluster, it will be your responsibility to configure it.
          However,
          our infrastructure-as-code system can support any resources that have an associated
          {" "}<a href="https://registry.terraform.io/browse/providers">Terraform provider.</a>{" "}We will connect it
          to our
          CI/CD system and provide infrastructure-as-code training at no additional cost.
        </p>
        <p>
          Additionally, if you need more holistic infrastructure support or bespoke customizations, we have a network of Panfactum-certified partners
          who can provide support. Ask your Panfactum solutions engineer to connect you with the right partner for your needs.
        </p>
      </FAQItem>
      <FAQItem title={"Where is Panfactum infrastructure deployed?"} id={"infrastructure-location"}>
        <p>
          All Panfactum infrastructure is deployed in your AWS accounts so you retain complete ownership and control.
        </p>
        <p>
          All of the code that we use to configure your infrastructure is stored directly in your version control system
          so that you always have complete visibility and access.
        </p>
        <p>
          If you choose to discontinue your plan for whatever reason, this will not impact your infrastructure
          systems in any way (unlike all other managed service providers).
        </p>
      </FAQItem>
      <FAQItem title={"Can support plan prices change?"} id={"price-changes"}>
        <p>
          When you sign-up for Panfactum support, your plan prices will be locked-in for the following 12 months so any
          price changes will not have any impact until plan renewal.
        </p>
        <p>
          If you need longer-term price commitments, we can offer up to three years of stable prices if you commit to
          certain spend levels during that term. Ask about this option when you connect with us to create your
          support plan.
        </p>
      </FAQItem>
      <FAQItem title={"Can I use the Panfactum framework without a support plan? What if I need to cancel?"} id={"support-plan-required"}>
        <p>
          Absolutely! The framework is free and open source. It will remain that way forever.
        </p>
        <p>
          The support plan is designed to provide you guaranteed success at a fraction of the price of a full-time
          engineer / team, not
          gate features and functionality behind a paywall.
        </p>
        <p>
          That said, the Panfactum framework is owned by Panfactum Group, Inc. This{" "}<em>does</em>{" "}create single-vendor
          risk,
          a topic that has{" "}<a href="https://news.ycombinator.com/item?id=40089842">gained more attention</a>{" "}after
          various
          license changes in the open source community. As the Panfactum framework is composed exclusively of open
          source code, we have direct experience
          handling the fallout of such events (<a href="https://opentofu.org/manifesto/">looking at you, Hashicorp</a>).
        </p>
        <p>
          We take this risk incredibly seriously and are looking for a long-term home for the OSS Panfactum framework. In the interim, you can
          take solace in the following:
        </p>
        <ul class="flex list-inside list-disc flex-col gap-4">
          <li>
            If the license ever did become proprietary (it won't), that could only impact future code. There would
            be{" "}<em>zero</em>{" "}impact to
            your existing systems.
          </li>
          <li>
            The framework is composed exclusively of industry-standard open-source tools and projects. In the absolute
            worst case, you'd simply need to manage
            them yourself without the Panfactum framework, leaving you no worse off than you are today.
          </li>
        </ul>
      </FAQItem>

    </Accordion>
  )
}

export default FAQS