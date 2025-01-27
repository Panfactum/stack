import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import {
  WORKLOAD_DEPLOYMENT_COST,
} from "@/pages/support/_components/priceConstants.ts";
import CalculatorDescriptionContainer from "@/pages/support/_components/solid/details/CalculatorDescriptionContainer.tsx";

const WorkloadCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      A <em>workload</em> is any containerized system deployed to a Panfactum
      cluster. We charge for each workload <em>deployment</em> as much of our
      support is focused on keeping your workloads healthy, efficient, and
      performant in <em>each</em> environment they are deployed to.
    </p>
    <p>
      This calculator assumes your workloads will be deployed to all clusters,
      but this does not necessarily need to be the case when creating your
      support contract.
    </p>
    <p>
      Workloads can include container images that you create (e.g., an API
      server) or our workload modules such as{" "}
      <a href="/docs/edge/reference/infrastructure-modules/submodule/kubernetes/kube_pg_cluster">
        our PostgreSQL database.
      </a>
    </p>

    <p>
      Each workload deployment is billed at a monthly rate of{" "}
      {CURRENCY_FORMAT.format(WORKLOAD_DEPLOYMENT_COST)}.
    </p>
    <p>Each workload deployment includes the following:</p>
    <ul class="flex list-inside list-decimal flex-col gap-2 pl-4">
      <li>
        Creation of any necessary infrastructure-as-code to manage the workload.
      </li>
      <li>
        Zero-downtime migration of the workload from any existing systems.
      </li>
      <li>Guaranteed infrastructure uptime SLAs.</li>
      <li>Conformance to all major compliance frameworks.</li>
      <li>
        Connection to a CI / CD pipeline for image building and
        infrastructure-as-code deployments, including Dockerfile creation and/or
        optimization.
      </li>
      <li>
        Connection to the observability platform including creation of any
        relevant monitors and alerts.
      </li>
      <li>Triaging and support on any infrastructure-related issues.</li>
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

export default WorkloadCountDescription;
