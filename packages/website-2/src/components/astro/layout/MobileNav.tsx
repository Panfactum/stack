import { Dialog } from "@kobalte/core/dialog";
import { IoMenu , IoClose } from "solid-icons/io";
import { type Component, createSignal, For } from "solid-js";

import { NAV_LINKS } from "@/components/astro/layout/NavLinks.ts";
import PanfactumLogo from "@/components/icons/panfactum-logo.svg?raw";
import Button from "@/components/solid/ui/Button.tsx";
import GetStartedButton from "@/components/solid/ui/GetStartedButton.tsx";
import { DISCORD_URL, GITHUB_URL } from "@/lib/constants.ts";

interface MobileNavProps {
  background: "primary" | "secondary" | "transparent";
}

const MobileNav: Component<MobileNavProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Dialog open={isOpen()} id="mobile-nav" onOpenChange={setIsOpen}>
      <Dialog.Trigger class="md:hidden">
        <IoMenu class="size-12" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          class={
            "bg-black/80 fixed inset-0 z-50 backdrop-blur-sm"
          }
        />
        <Dialog.Content
          class={`fixed top-0 z-[100] flex max-h-[80vh] w-screen flex-col overflow-y-scroll ${props.background === "primary" ? "bg-secondary" : "bg-primary"}`}
        >
          <div class="flex h-[--header-height] items-center justify-between px-4">
            {/* eslint-disable solid/no-innerhtml,jsx-a11y/anchor-has-content */}
            <a
              innerHTML={PanfactumLogo}
              href="/"
              class="flex h-full max-w-[75%]  items-center [&>svg]:h-3/5"
            />
            {/* eslint-enable solid/no-innerhtml,jsx-a11y/anchor-has-content */}

            <Dialog.CloseButton>
              <IoClose class="size-12" />
            </Dialog.CloseButton>
          </div>
          <nav
            aria-label="Primary"
            class="grid grid-cols-1 gap-4 p-4 text-xl sm:grid-cols-2"
          >
            <For each={NAV_LINKS}>{(link) => (
              <a href={link.url} data-astro-prefetch="viewport">
                <button
                  class={`hover:text-secondary cursor-pointer bg-transparent font-bold`}
                >
                  {link.title}
                </button>
              </a>
            )}</For>
            <span class="mt-4 flex flex-col gap-3 sm:col-span-2">
              <GetStartedButton />
              <a href={GITHUB_URL}>
                <Button variant={"secondary"} class="w-full">
                  Github
                </Button>
              </a>
              <a href={DISCORD_URL}>
                <Button variant={"secondary"} class="w-full">
                  Discord
                </Button>
              </a>
            </span>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default MobileNav;
