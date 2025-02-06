import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import {
  CUSTOM_WORKLOAD_DEPLOYMENT_COST,
} from "@/pages/_components/priceConstants.ts";

const CustomWorkloadCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      <span class="font-semibold">Base Cost:</span> {CURRENCY_FORMAT.format(CUSTOM_WORKLOAD_DEPLOYMENT_COST)} / cluster (before
      any support modifiers or discounts)
    </p>
    <p>
      A custom workload is workload that requires new infrastructure-as-code to deploy to a Panfactum cluster. This can
      be first-party application code that your engineering team develops or third-party systems provided via a registry
      like Docker Hub.
    </p>
    <p>
      Because these modules typically involve extensive, complex, and repeated work, we charge a higher rate
      than our off-the-shelf modules.
    </p>
    <p>Specifically, each workload deployment includes the following:</p>
    <ul class="flex list-inside list-decimal flex-col gap-2 pl-4">
      <li>
        Creation of any necessary infrastructure-as-code to manage the workload. Where feasible, we will
        also build the necessary infrastructure-as-code for integration with external systems (e.g., AWS, DNS providers,
        etc.).
      </li>
      <li>
        Zero-downtime migration of the workload from any existing systems.
      </li>
      <li>Guaranteed infrastructure uptime SLAs.</li>
      <li>Proactive resource tuning to minimize infrastructure costs while supporting arbitrary load.</li>
      <li>Conformance to all major compliance frameworks.</li>
      <li>Build-time and run-time security scanning and intrusion prevention.</li>
      <li>
        Connection to a CI / CD pipeline for image building and
        infrastructure-as-code deployments, including Dockerfile creation and/or
        optimization.
      </li>
      <li>
        Creation of a local development environment.
      </li>
      <li>
        Connection to the Panfactum observability platform including creation of any
        relevant monitors and alerts.
      </li>
      <li>Frontline triaging and support on any infrastructure-related issues.</li>
    </ul>
    <p>
      <em>
        Sometimes it can be difficult to assess if a system component should be
        considered a discrete workload (e.g. a simple CronJob that runs only
        once per year). Oftentimes, we can bundle multiple components into a
        single workload for billing purposes. We will work with you to ensure
        that the workload boundaries make sense and that you are not
        overcharged.
      </em>
    </p>
  </CalculatorDescriptionContainer>
);

export default CustomWorkloadCountDescription;
