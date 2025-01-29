import { FaSolidArrowLeft } from "solid-icons/fa";
import {type Component, Show} from "solid-js";

import Button from "@/components/ui/Button.tsx";

interface MarkdownGuidedNavButtonProps {
  href: string | undefined;
  text: string;
  icon: "left" | "right";
}

const MarkdownGuideNavButton: Component<MarkdownGuidedNavButtonProps> = (
  props,
) => {

  return (
    <Show
      when={props.href}
      fallback={<div class="w-36"/>}
    >
      <Button variant={`primary`} size={'sm'}>
        <a href={props.href} class={`flex items-center gap-x-2 !text-white !no-underline`}>
          {props.icon === "right" ? null : <FaSolidArrowLeft class={"!text-white"}/>}
          {props.text}
          {props.icon === "left" ? null : <FaSolidArrowLeft class="rotate-180 !text-white" />}
        </a>
      </Button>
    </Show>
  )
};

export default MarkdownGuideNavButton;
