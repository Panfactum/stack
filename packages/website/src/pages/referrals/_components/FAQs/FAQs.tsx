import { Accordion } from "@kobalte/core/accordion";
import type { Component } from "solid-js";

import "./animation.css";
import FAQItem from ".//FAQItem.tsx";

const FAQS: Component = () => {
  return (
    <Accordion
      class="w-full max-w-screen-md xl:max-w-screen-lg"
      multiple={true}
    >
      <FAQItem
        title={"How many times can I receive the $10,000 bonus?"}
        id={"times"}
      >
        There is no limit to the amount of times that you can receive the bonus.
      </FAQItem>
      <FAQItem title={"Who are the ideal users?"} id={"users"}>
        Organizations that meet the following criteria would likely benefit from
        using Panfactum:
        <ul class="flex list-disc flex-col gap-4 pl-4">
          <li>Plans to spend over $15,000 on AWS in the next 12 months; and</li>
          <li>Employs at least one software developer; and</li>
          <li>Is headquartered in North America.</li>
        </ul>
        <p>
          We work successfully with both early-stage startups and large
          organizations with lots of preexisting infrastructure.
        </p>
        <p>
          The benefits are not tied to a particular sector or industry. We work
          with users across all fields including but not limited to finance,
          healthcare, HR, software-as-a-service (SaaS), construction, logistics,
          manufacturing, retail, AI, etc.
        </p>
      </FAQItem>
      <FAQItem title={"Can I refer my own organization?"} id={"own-referral"}>
        <p>
          Yes. However, we do recommend that you disclose the potential
          conflict-of-interest and check your organization's purchasing policies
          to ensure you are not violating any rules against receiving payments
          from vendors.
        </p>
        <p>
          If the referral payment would put you in violation of an organization
          policy, we are happy to apply the referral bonus to your
          organization's plan instead.
        </p>
      </FAQItem>
      <FAQItem
        title={"Can you split the referral bonus with others?"}
        id={"split"}
      >
        Absolutely. We will defer to the preferences of the initial referrer who
        will let us know how they want it allocated.
      </FAQItem>
      <FAQItem title={"Do you provide affiliate links?"} id={"affiliate-links"}>
        No.
      </FAQItem>
      <FAQItem
        title={"Have a more complex situation or further questions?"}
        id={"complex"}
      >
        <p>
          Reach out to CEO Jack Langston at{" "}
          <a href="mailto:jack@panfactum.com">jack@panfactum.com</a> or{" "}
          <a href="https://cal.com/jack-langston/chat?user=jack-langston&duration=15">
            set up a time to chat live.
          </a>
        </p>
      </FAQItem>
    </Accordion>
  );
};

export default FAQS;
