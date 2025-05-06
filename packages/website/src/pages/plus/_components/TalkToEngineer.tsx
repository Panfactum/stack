import { Image } from "@unpic/solid";
import { onMount, type Component } from "solid-js";

import EngineerJack from "./images/engineer-jack.png";

export const TalkToEngineer: Component = () => {
  onMount(() => {
    // Load the Fillout embed script dynamically
    const script = document.createElement("script");
    script.src = "https://server.fillout.com/embed/v1/";
    script.async = true;
    document.body.appendChild(script);
  });

  return (
    <section class="bg-white py-24 text-white dark:bg-gray-dark-mode-950">
      <div class="container mx-auto px-4">
        <div class="flex flex-row items-center justify-between gap-8">
          <div class="w-full md:w-1/2">
            <div class="ml-8">
              <h2 class="text-display-xl mb-2 font-machina font-medium text-gray-light-mode-900 dark:text-white">
                Talk to an engineer
              </h2>
              <p class="mb-6 text-gray-light-mode-600 dark:text-gray-dark-mode-400">
                Our friendly team would love to hear from you.
              </p>
            </div>
            <div
              class="w-full"
              data-fillout-id="niiLwEASKvus"
              data-fillout-embed-type="standard"
              data-fillout-inherit-parameters
              data-fillout-dynamic-resize
            />
          </div>
          <div class="hidden w-1/2 items-center justify-center md:flex">
            <Image
              src={EngineerJack.src}
              alt="Panfactum Engineer"
              class="rounded-lg"
              width={500}
              height={375}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
