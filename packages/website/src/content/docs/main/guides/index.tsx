import Button from "@/components/ui/Button.tsx";
import ContentBlockWithImage, {
  ContentBlockType,
} from "@/components/ui/ContentBlockWithImage.tsx";
import Check from "@/content/docs/main/guides/check.tsx";
import Todo from "@/content/docs/main/guides/todo.tsx";

export function RootDocumentLandingPage() {
  return (
    <div>
      <h1 class="text-display-lg">Getting Started</h1>
      <p>
        The Panfactum framework is a unified architecture combining two sets of
        tools:
      </p>
      <ul>
        <li>
          <b>Panfactum Kubernetes Clusters</b>: Tools that run in your
          organization's cloud computing environment
        </li>
        <li>
          <b>Panfactum devShell</b>: Tools that run locally on your machine
        </li>
      </ul>

      <p>
        With these two sets of utilities, you can begin deploying cloud
        workloads in the most cost-effective, secure, and production-ready way
        possible on modern cloud hyperscalers like AWS.
      </p>

      <p
        class={`
          mb-2 font-machina text-display-md font-semibold tracking-tight
          text-primary
        `}
      >
        Has your organization already setup a Panfactum Kubernetes Cluster?
      </p>

      <div
        class={`
          flex w-full flex-col items-stretch justify-stretch gap-4
          md:flex-row
        `}
      >
        <ContentBlockWithImage
          title="No, we're new to Panfactum."
          content="The first step in using Panfactum is setting up the core infrastructure including your first Kubernetes cluster. We provide a comprehensive bootstrapping guide to take you through this process."
          type={ContentBlockType.VERTICAL}
          image={Todo}
          bgColor="bg-gradient-to-br from-gray-dark-mode-500 to-gray-dark-mode-700"
        >
          <a href="/docs/main/guides/bootstrapping/overview">
            <Button variant="primary" class="w-full">
              Setup Panfactum Kubernetes Infrastructure
            </Button>
          </a>
        </ContentBlockWithImage>
        <ContentBlockWithImage
          title="Yes, we have Panfactum installed!"
          content="We provide a devShell for every operating system that comes with all of the necessary tooling to connect to your installation of Panfactum. Let's get you connected."
          type={ContentBlockType.VERTICAL}
          image={Check}
          bgColor="bg-gradient-to-br from-brand-800 to-brand-600"
        >
          <a href="/docs/main/guides/getting-started/overview">
            <Button variant="primary" class="w-full">
              Setup the Panfactum devShell
            </Button>
          </a>
        </ContentBlockWithImage>
      </div>
    </div>
  );
}
