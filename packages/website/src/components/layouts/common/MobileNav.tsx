import { Dialog } from "@kobalte/core/dialog";
import { IoMenu, IoClose } from "solid-icons/io";
import { type Component, createSignal, For } from "solid-js";

import { PanfactumLogoIcon } from "@/components/icons/PanfactumLogoIcon";
import Button from "@/components/ui/Button.tsx";
import GetStartedButton from "@/components/ui/GetStartedButton.tsx";
import { DISCORD_URL, GITHUB_URL } from "@/lib/constants.ts";

import type { NavLink } from "./types";

interface MobileNavProps {
  links: NavLink[];
  fullPath: string;
}

const MobileNav: Component<MobileNavProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Dialog open={isOpen()} id="mobile-nav" onOpenChange={setIsOpen}>
      <Dialog.Trigger
        class={`
          block
          md:hidden
        `}
      >
        <IoMenu class="size-12" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          class={"fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"}
        />
        <Dialog.Content
          class={`
            fixed top-0 z-[100] flex max-h-[80vh] w-screen flex-col
            overflow-y-scroll bg-primary
          `}
        >
          <div
            class={`flex h-(--header-height) items-center justify-between px-4`}
          >
            <a href="/" class={`flex h-full max-w-[75%] items-center`}>
              <PanfactumLogoIcon class="h-3/5" />
            </a>

            <Dialog.CloseButton>
              <IoClose class="size-12" />
            </Dialog.CloseButton>
          </div>
          <nav
            aria-label="Primary"
            class={`
              grid grid-cols-1 gap-4 p-4 text-xl
              sm:grid-cols-2
            `}
          >
            <For each={props.links}>
              {(link) => (
                <a href={link.url} data-astro-prefetch="viewport">
                  <button
                    class={`
                      cursor-pointer bg-transparent font-bold
                      hover:text-secondary
                    `}
                  >
                    {link.title}
                  </button>
                </a>
              )}
            </For>
            <span
              class={`
                mt-4 flex flex-col gap-3
                sm:col-span-2
              `}
            >
              <GetStartedButton fullPath={props.fullPath} />
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
