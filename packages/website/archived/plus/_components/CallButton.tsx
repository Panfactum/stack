import { Button } from "@kobalte/core/button";
import { onMount, type ParentComponent } from "solid-js";

const CallButton: ParentComponent = (props) => {
  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    document.body.appendChild(script);
  });
  return (
    <Button
      data-fillout-id="5Ce2EHxTqnus"
      data-fillout-embed-type="popup"
      data-fillout-dynamic-resize
      data-fillout-inherit-parameters
      data-fillout-popup-size="medium"
      class="flex cursor-pointer items-center gap-4 text-nowrap rounded-xl bg-gold-300 px-4 py-2 font-bold text-gray-light-mode-800 shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
    >
      {props.children}
    </Button>
  );
};

export default CallButton;
