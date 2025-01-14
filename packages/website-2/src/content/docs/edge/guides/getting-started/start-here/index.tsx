import type { Metadata } from "next";
import type React from "react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Start Here",
};

export function PageTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`font-machina text-primary text-display-sm tracking-tight font-[300] ${className || ""}`}
    >
      <h1
        style={{
          marginTop: "inherit",
          marginBottom: "inherit",
          color: "inherit",
          lineHeight: "inherit",
          fontSize: "inherit",
        }}
      >
        {children}
      </h1>
    </div>
  );
}

export function TitleText({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`font-machina text-primary text-display-xs tracking-tight font-semibold ${className || ""}`}
    >
      <p style={{ marginTop: "inherit", marginBottom: "inherit" }}>
        {children}
      </p>
    </div>
  );
}

export function BodyText({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`text-sm text-primary ${className}`}>
      <p style={{ marginTop: "inherit", marginBottom: "inherit" }}>
        {children}
      </p>
    </div>
  );
}

enum ContentBlockType {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

export function ContentBlockWithImage({
  className,
  title,
  content,
  image,
  children,
  bgColor = "bg-dark-blue-gradient",
  type = ContentBlockType.HORIZONTAL,
}: {
  className?: string;
  title: string;
  content: string;
  image?: React.ReactNode;
  children: React.ReactNode;
  bgColor?: string;
  type: ContentBlockType;
}) {
  return (
    <div
      className={`flex items-stretch bg-primary border border-primary rounded-md overflow-hidden w-full ${type === ContentBlockType.HORIZONTAL ? "flex-col sm:flex-row" : "flex-col"} ${className || ""}`}
    >
      <div
        className={`
        image-block flex-none flex items-center justify-center text-white ${bgColor} ${type === ContentBlockType.HORIZONTAL ? "w-full sm:w-1/3 h-[200px] sm:h-auto" : "h-[200px]"}`}
      >
        <div className="w-[94px] h-[94px] rounded-full border-4 outer-ring flex items-center justify-center">
          <div className="w-[72px] h-[72px] rounded-full border-4 inner-ring flex items-center justify-center">
            {image}
          </div>
        </div>
      </div>
      <div className="flex-1 p-5">
        <p
          className="text-lg font-semibold text-primary"
          style={{ marginTop: 0, marginBottom: "4px" }}
        >
          {title}
        </p>
        <p
          className="text-sm text-tertiary"
          style={{ marginTop: 0, marginBottom: "16px" }}
        >
          {content}
        </p>
        {children}
      </div>
    </div>
  );
}

export function SeparatorWithText({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center min-h-[16px] ${className || ""}`}
    >
      <div className="flex-1 h-[1px] w-full border-b border-primary" />
      {text && (
        <p
          className="text-lg font-semibold px-2"
          style={{ marginTop: 0, marginBottom: 0 }}
        >
          {text}
        </p>
      )}
      <div className="flex-1 h-[1px] w-full border-b border-primary" />
    </div>
  );
}

export function NextStepInfoBox({
  title,
  content,
  children,
}: {
  title: string;
  content: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-4 border border-primary rounded-md bg-primary">
      <p
        className="text-lg font-semibold text-primary"
        style={{ marginTop: 0, marginBottom: "4px" }}
      >
        {title}
      </p>
      <p
        className="text-sm font-regular text-tertiary"
        style={{ marginTop: 0, marginBottom: "16px" }}
      >
        {content}
      </p>
      {children}
    </div>
  );
}

export function RootDocumentLandingPage() {
  return (
    <div className="getting-started">
      <PageTitle className="mb-4">Getting Started</PageTitle>
      <BodyText className="mb-4">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. 
      </BodyText>
      <TitleText className="mb-2">
        Has your organization already installed Panfactum?
      </TitleText>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-4 w-full">
        <ContentBlockWithImage
          title="Yes, we have Panfactum installed"
          content="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
          image={
            <svg
              width="52"
              height="52"
              viewBox="0 0 52 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M49.3337 23.8665V26.0132C49.3308 31.0448 47.7015 35.9408 44.6888 39.9708C41.676 44.0008 37.4413 46.949 32.6162 48.3756C27.791 49.8023 22.6339 49.631 17.9141 47.8872C13.1942 46.1435 9.16452 42.9208 6.4259 38.6997C3.68728 34.4786 2.3865 29.4853 2.71757 24.4646C3.04864 19.4438 4.99381 14.6646 8.26298 10.8397C11.5321 7.01477 15.9502 4.34908 20.8581 3.2402C25.766 2.13132 30.901 2.63865 35.497 4.68653M49.3337 7.33317L26.0003 30.6898L19.0003 23.6898"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          }
          type={ContentBlockType.VERTICAL}
          className="mb-6"
        >
          <a href="/">
            <Button size={"lg"} variant="primary" className="w-full">
              Start here
            </Button>
          </a>
        </ContentBlockWithImage>

        <ContentBlockWithImage
          title="No, we're new to Panfactum"
          content="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
          image={
            <svg
              width="46"
              height="46"
              viewBox="0 0 46 46"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20.6667 4.33333H13.2C9.27963 4.33333 7.31945 4.33333 5.82207 5.09629C4.50493 5.7674 3.43407 6.83827 2.76295 8.1554C2 9.65278 2 11.613 2 15.5333V32.8C2 36.7204 2 38.6806 2.76295 40.1779C3.43407 41.4951 4.50493 42.5659 5.82207 43.237C7.31945 44 9.27963 44 13.2 44H30.4667C34.387 44 36.3472 44 37.8446 43.237C39.1617 42.5659 40.2326 41.4951 40.9037 40.1779C41.6667 38.6806 41.6667 36.7204 41.6667 32.8V25.3333M25.3333 34.6667H11.3333M30 25.3333H11.3333M41.9497 4.05025C44.6834 6.78392 44.6834 11.2161 41.9497 13.9497C39.2161 16.6834 34.7839 16.6834 32.0503 13.9497C29.3166 11.2161 29.3166 6.78392 32.0503 4.05025C34.7839 1.31658 39.2161 1.31658 41.9497 4.05025Z"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          }
          type={ContentBlockType.VERTICAL}
          bgColor="bg-light-blue-gradient"
          className="mb-6"
        >
          <a href="/">
            <Button size={"lg"} variant="primary" className="w-full">
              Start here
            </Button>
          </a>
        </ContentBlockWithImage>
      </div>
    </div>
  );
}

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
    <div className="">
      <PageTitle className="mb-4">Getting Started</PageTitle>
      <BodyText className="mb-4">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. 
      </BodyText>
      <TitleText className="mb-2">First, do this important thing</TitleText>

      <ContentBlockWithImage
        title="Thing to do"
        content="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        image={
          <svg
            width="46"
            height="46"
            viewBox="0 0 46 46"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.6667 4.33333H13.2C9.27963 4.33333 7.31945 4.33333 5.82207 5.09629C4.50493 5.7674 3.43407 6.83827 2.76295 8.1554C2 9.65278 2 11.613 2 15.5333V32.8C2 36.7204 2 38.6806 2.76295 40.1779C3.43407 41.4951 4.50493 42.5659 5.82207 43.237C7.31945 44 9.27963 44 13.2 44H30.4667C34.387 44 36.3472 44 37.8446 43.237C39.1617 42.5659 40.2326 41.4951 40.9037 40.1779C41.6667 38.6806 41.6667 36.7204 41.6667 32.8V25.3333M25.3333 34.6667H11.3333M30 25.3333H11.3333M41.9497 4.05025C44.6834 6.78392 44.6834 11.2161 41.9497 13.9497C39.2161 16.6834 34.7839 16.6834 32.0503 13.9497C29.3166 11.2161 29.3166 6.78392 32.0503 4.05025C34.7839 1.31658 39.2161 1.31658 41.9497 4.05025Z"
              stroke="currentColor"
              stroke-width="4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        }
        type={ContentBlockType.HORIZONTAL}
        bgColor="bg-light-blue-gradient"
        className="mb-6"
      >
        <a href="/">
          <Button size={"lg"} variant="primary" className="w-full sm:w-fit">
            Start here
          </Button>
        </a>
      </ContentBlockWithImage>

      <SeparatorWithText text="Do next" className="mb-6" />

      {mockNextTodoSteps && mockNextTodoSteps.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {mockNextTodoSteps.map((step, index) => (
            <div
              key={`next-step-${index}`}
              className="col-span-4 md:col-span-2"
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
