import Button from "../src/components/ui/Button.tsx";

const mockNextTodoSteps = [
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
  {
    title: "Thing to do",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    linkUrl: "/",
  },
];

export function GettingStarted() {
  return (
    <div>
      <h1 class="mb-4">Getting Started</h1>
      <p class="mb-4">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </p>
      <p class="mb-2 font-machina text-primary text-display-xs tracking-tight font-semibold">First, do this important thing</p>

      <ContentBlockWithImage
        title="Thing to do"
        content="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        type={ContentBlockType.HORIZONTAL}
        bgColor="bg-light-blue-gradient"
        class="mb-6"
      >
        <a href="/packages/website/public">
          <Button size={"lg"} variant="primary" class="w-full sm:w-fit">
            Start here
          </Button>
        </a>
      </ContentBlockWithImage>

      <SeparatorWithText text="Do next" class="mb-6" />

      {mockNextTodoSteps && mockNextTodoSteps.length > 0 && (
        <div class="grid grid-cols-4 gap-4">
          {mockNextTodoSteps.map((step, index) => (
            <div

              class="col-span-4 md:col-span-2"
            >
              <NextStepInfoBox title={step.title} content={step.content}>
                <a href={step.linkUrl}>
                  <Button size={"lg"} variant="outline">
                    Start
                  </Button>
                </a>
              </NextStepInfoBox>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}