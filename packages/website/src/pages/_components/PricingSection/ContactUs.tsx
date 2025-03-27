import { Button } from "@kobalte/core/button";
import { Image } from "@unpic/solid";
import { onMount, type Component } from "solid-js";

import CalendarIcon from "./images/CalendarIcon";
import Engineers from "./images/engineers.png";

const ContactUs: Component = () => {
  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    document.body.appendChild(script);
  });
  return (
    <div class="mt-10 flex flex-col items-center justify-between gap-8 overflow-hidden rounded-lg bg-brand-700 shadow-md md:flex-row dark:bg-brand-800">
      <div class="flex items-center gap-4 px-4 py-6 md:px-8">
        <div class="flex flex-col items-center gap-y-2 md:items-start">
          <div class="font-machina text-xl font-medium md:text-2xl">
            Talk to an engineer
          </div>
          <div class="text-secondary text-center md:text-left">
            Join dozens of companies already growing with Panfactum.
          </div>
          <Button
            data-fillout-id="5Ce2EHxTqnus"
            data-fillout-embed-type="popup"
            data-fillout-dynamic-resize
            data-fillout-inherit-parameters
            data-fillout-popup-size="medium"
            class="mt-4 flex cursor-pointer items-center gap-4 text-nowrap rounded bg-gray-dark-mode-300 px-4 py-2 font-semibold text-gray-light-mode-800 shadow shadow-gray-dark-mode-400 hover:bg-gray-dark-mode-500"
          >
            <span class="size-6">
              <CalendarIcon />
            </span>
            Schedule a Call
          </Button>
        </div>
      </div>
      <Image
        src={Engineers.src}
        alt="Panfactum Engineers"
        width={480}
        height={216}
        class="hidden md:block"
      />
    </div>
  );
};

export default ContactUs;
