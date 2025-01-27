import type { Component } from "solid-js";

import Button from "@/components/solid/ui/Button.tsx";

interface GetStartedProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const GetStartedButton: Component<GetStartedProps> = (props) => {
  return (
    <a href={"/fixme"}>
      <Button size={props.size} variant="primary" class="w-full">
        Get Started
      </Button>
    </a>
  );
};

export default GetStartedButton;
