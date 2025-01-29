import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/support/_components/details/CalculatorDescriptionContainer.tsx";
import { CLUSTER_COST } from "@/pages/support/_components/priceConstants.ts";

const ClusterCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      Each cluster is billed at a monthly rate of{" "}
      {CURRENCY_FORMAT.format(CLUSTER_COST)}.
    </p>
    <p>
      Each production-ready Panfactum Kubernetes cluster includes the following:
    </p>
    <ul class="flex list-inside list-decimal flex-col gap-2 pl-4">
      <li>
        Installation and management of all components found in the{" "}
        <a href="/docs/edge/guides/bootstrapping/overview">
          bootstrapping guide.
        </a>
      </li>
      <li>
        Installation and management of optional extras such as the monitoring
        and workflow systems.
      </li>
      <li>
        Kubernetes major version upgrades at a cadence that ensures you will not
        need to pay for{" "}
        <a href="https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html#extended-support-faqs">
          AWS EKS Extended Support.
        </a>
      </li>
    </ul>
  </CalculatorDescriptionContainer>
);

export default ClusterCountDescription;
