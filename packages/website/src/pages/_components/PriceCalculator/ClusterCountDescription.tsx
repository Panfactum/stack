import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import { CLUSTER_COST } from "@/pages/_components/priceConstants.ts";

const ClusterCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      <span class="font-semibold">Base Cost:</span>{" "}
      {CURRENCY_FORMAT.format(CLUSTER_COST)} / cluster (before any support
      modifiers or discounts)
    </p>
    <p>
      The Panfactum Kubernetes cluster is the most production-ready,
      security-hardened, and cost-effective way to run workloads in the cloud.
      For every component we will proactively deploy the latest updates and
      security patches as well as provide frontline support (up to and including
      patching the upstream projects if necessary).
    </p>
    <p>Each cluster includes the following:</p>
    <ul class="flex list-inside list-decimal flex-col gap-2 pl-4">
      <li>
        A dedicated AWS account in your AWS organization that includes
        conformance to our hardening standards.
      </li>
      <li>
        A dedicated <a href="https://docs.aws.amazon.com/vpc/">VPC</a> with the
        appropriate network segmentation and our improved NAT gateway system.
      </li>
      <li>
        A dedicated DNS subdomain for cluster workloads (including our subdomain
        delegation system, if required). Automatic DNS synchronization with{" "}
        <a href="https://github.com/kubernetes-sigs/external-dns">
          ExternalDNS
        </a>
        .
      </li>
      <li>
        A hardened <a href="https://aws.amazon.com/eks/">EKS</a> deployment that
        is kept updated so you do <em>not</em> need to pay the{" "}
        <a href="https://aws.amazon.com/blogs/containers/amazon-eks-extended-support-for-kubernetes-versions-pricing/">
          additional $360 / month extended support surcharge.
        </a>{" "}
        Includes a custom bin-packing pod scheduler that can decrease costs by
        up to 30% compared to the built-in EKS scheduler.
      </li>
      <li>
        Built-in cluster autoscaling provided by{" "}
        <a href="https://karpenter.sh/">Karpenter</a> with custom configuration
        to optimize total cost savings.
      </li>
      <li>
        Built-in pod autoscaling provided by{" "}
        <a href="https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler">
          Vertical Pod Autoscaler
        </a>{" "}
        so that you never need to manually configure resource sizes for your
        workloads.
      </li>
      <li>
        Out-of-the-box integration with{" "}
        <a href="https://aws.amazon.com/ebs/">AWS EBS</a> for durable storage
        including automatic storage autoscaling.
      </li>
      <li>
        The <a href="https://cilium.io/">Cilium</a> network firewall and
        observability tooling.
      </li>
      <li>
        The <a href="https://linkerd.io/">Linkerd</a> service-mesh for automatic
        network encryption and additional L7 capabilities (e.g., network-level
        retries, locality-aware routing, etc.).
      </li>
      <li>
        An optimized deployment of the components in the{" "}
        <a href="https://grafana.com/about/grafana-stack/">Grafana Stack</a> for
        automatic collection of logs, metrics, and traces. This includes dozens
        of out-of-the-box dashboards and alerts for the various infrastructure
        components as well as a deployment of{" "}
        <a href="https://www.opencost.io/">OpenCost</a> so that you have
        granular cost data about every workload you deploy to your cluster.
      </li>
      <li>
        A customized{" "}
        <a href="https://kubernetes.github.io/ingress-nginx/">
          NGINX Ingress Controller
        </a>{" "}
        that can handle traffic at any scale with built-in support for HTTP
        complexities like{" "}
        <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS">
          CORS
        </a>
        ,{" "}
        <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP">CSP</a>,
        and rate-limiting. Additionally, includes automatic integration with{" "}
        <a href="https://aws.amazon.com/cloudfront/">AWS Cloudfront</a> for
        best-in-class performance and additional security hardening.
      </li>
      <li>
        Automatic public/private TLS certificate provisioning with{" "}
        <a href="https://cert-manager.io/">cert-manager</a>. Includes automatic
        rotation in accordance with industry best-practices.
      </li>
      <li>
        A highly-available deployment of{" "}
        <a href="https://www.vaultproject.io/">Hashicorp Vault</a> for secrets
        management.
      </li>
      <li>
        A highly-available deployment of{" "}
        <a href="https://argoproj.github.io/workflows/">Argo Workflows</a> and{" "}
        <a href="https://github.com/moby/buildkit">BuildKit</a> to 10x the speed
        of your CI/CD systems.
      </li>
      <li>
        A highly-available deployment of the{" "}
        <a href="https://goauthentik.io/">Authentik IdP</a> to replace expensive
        alternatives like Okta.
      </li>
      <li>
        Automatic, hourly full-cluster backups managed by{" "}
        <a href="https://velero.io/">Velero</a>. Includes all stateful{" "}
        <a href="https://aws.amazon.com/ebs/">EBS volumes</a> utilized by
        workloads in your cluster so you are never at risk of losing data.
      </li>
      <li>
        The{" "}
        <a href="https://github.com/kubernetes-sigs/descheduler">Descheduler</a>{" "}
        to automatically detect and resolve pod-level infrastructure problems.
      </li>
      <li>
        The <a href="https://kyverno.io/">Kyverno</a> policy engine so that you
        can provide additional organizational controls and customize the default
        Kubernetes behavior.
      </li>
      <li>
        Automatic image caching to provide faster startup times and add
        resiliency to third-party registry outages.
      </li>
      <li>
        Integration with the Panfactum devShell which allows any developer to
        get started working with clusters in minutes from any maintain operating
        system (Windows, macOS, Linux). Access is automatically controlled via
        the same SSO paradigm as your AWS account (which we will configure if
        not already provided).
      </li>
      <li>
        A custom, SSO-integrated SSH bastion which allows you to securely
        connect to all of your private network resources without the need for a
        heavy-handed, complex VPN.
      </li>
    </ul>
  </CalculatorDescriptionContainer>
);

export default ClusterCountDescription;
