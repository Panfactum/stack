import { type Component, Show } from "solid-js";
import { isServer } from "solid-js/web";

import MarkdownGuideNav from "@/components/markdown/MarkdownGuideNav.tsx";

// We use this component to make it clear to people who are following
// the bootstrapping guide that they should return to the bootstrapping
// guide instead of continuing to the rest of the "getting started" guide.
const NextSteps: Component = () => {
  const isBootstrapping = () =>
    !isServer && window.location.search.includes("bootstrapping=true");

  return (
    <Show
      when={isBootstrapping()}
      fallback={
        <div class="mt-2 flex flex-col gap-2">
          We are now ready to launch your organization&apos;s developer
          environment.
          <MarkdownGuideNav
            backHref={"/docs/stable-25-04/guides/getting-started/overview"}
            forwardHref={
              "/docs/stable-25-04/guides/getting-started/boot-developer-environment"
            }
            stepNumber={2}
            totalSteps={4}
            progressLabel={"Getting Started Guide:"}
          />
        </div>
      }
    >
      <div class="mt-2 flex flex-col gap-2">
        <p>
          Now that you have the core tooling installed, you can{" "}
          <a
            href="/docs/stable-25-04/guides/bootstrapping/installing-devshell#install-prerequisite-tooling"
            class={`
              text-primary underline
              hover:cursor-pointer
            `}
          >
            return to the bootstrapping guide.
          </a>
        </p>
      </div>
    </Show>
  );
};

export default NextSteps;
