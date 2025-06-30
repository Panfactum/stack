// Product card component matching the DevOps Foundations Setup design
// Features dark background, icon container, structured content layout with learn more button
import { clsx } from "clsx";
import { HiOutlineArrowRight } from "solid-icons/hi";
import { type Component, For, createSignal, onCleanup } from "solid-js";

import { CheckBullet } from "@/components/ui/CheckBullet";

// Product card props interface
export interface ProductCardProps {
  title: string;
  mobileTitle?: string;
  subtitle: string;
  bullets: string[];
  image: string;
  ribbon?: string;
  ribbonColor?: string;
  className?: string;
  href?: string;
}

export const ProductCard: Component<ProductCardProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);
  const [hasBeenHovered, setHasBeenHovered] = createSignal(false);
  let hoverTimeout: ReturnType<typeof setTimeout> | undefined;

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Only expand after 500ms of continuous hover
    hoverTimeout = setTimeout(() => {
      setHasBeenHovered(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Clear the timeout if user leaves before 500ms
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = undefined;
    }
  };

  // Clean up timeout on unmount
  onCleanup(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  });

  const cardClass = () =>
    clsx(
      `
        group relative flex cursor-pointer flex-col overflow-hidden rounded-xl
        bg-primary transition-all duration-300
        hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-dark-mode-950/50
        lg:flex-row
      `,
      props.className,
    );

  const cardContent = () => (
    <>
      {/* Top-right diagonal ribbon */}
      {props.ribbon && (
        <div class="absolute top-0 right-0 z-10 h-0 w-0">
          <div
            class={clsx(
              `
                absolute top-6 -right-20 rotate-[25deg] px-24 py-3 text-xs
                font-bold tracking-wider whitespace-nowrap text-white uppercase
                shadow-lg
              `,
              props.ribbonColor || "bg-brand-600",
            )}
          >
            {props.ribbon}
          </div>
        </div>
      )}

      {/* Left content section */}
      <div class="flex flex-1 flex-col gap-6 p-8">
        {/* Product title with appropriate typography */}
        <h3 class="font-machina text-display-md font-bold text-primary">
          {/* Mobile title */}
          <span class="md:hidden">{props.mobileTitle || props.title}</span>

          {/* Desktop title */}
          <span
            class={`
              hidden
              md:inline
            `}
          >
            {props.title}
          </span>
        </h3>

        {/* Subtitle with proper text hierarchy */}
        <p class="text-display-xs text-tertiary">{props.subtitle}</p>

        {/* Bullet point list with consistent spacing */}
        <div
          class={clsx(
            `
              hidden transition-[grid-template-rows] duration-700 ease-in-out
              lg:grid
            `,
            hasBeenHovered() ? `grid-rows-[1fr]` : `grid-rows-[0fr]`,
          )}
        >
          <div class="overflow-hidden">
            <ul class="flex flex-col gap-3">
              <For each={props.bullets}>
                {(bullet, index) => (
                  <div
                    class={clsx(
                      `transition-all duration-300 ease-out`,
                      hasBeenHovered()
                        ? `translate-x-0 opacity-100`
                        : `translate-x-[-20px] opacity-0`,
                    )}
                    style={{
                      "transition-delay":
                        hasBeenHovered() && !isHovered()
                          ? `0ms`
                          : `${index() * 400}ms`,
                    }}
                  >
                    <CheckBullet>{bullet}</CheckBullet>
                  </div>
                )}
              </For>
            </ul>
          </div>
        </div>

        {/* Learn more indicator with arrow icon */}
        <div
          class={clsx(
            `
              relative mt-auto inline-flex w-fit items-center gap-2
              overflow-hidden rounded-lg border border-brand-600 px-4 py-2
              font-medium transition-all
              group-hover:shadow-lg group-hover:shadow-brand-600/20
            `,
            hasBeenHovered() ? `text-white` : `text-brand-400`,
          )}
        >
          <span
            class={clsx(
              `absolute inset-0 bg-brand-600 transition-transform ease-out`,
              hasBeenHovered()
                ? `translate-x-0 duration-[1100ms]`
                : `-translate-x-full duration-300`,
            )}
          />
          <span class="relative">Learn more</span>
          <HiOutlineArrowRight
            size={20}
            class={clsx(
              `relative transition-transform duration-300`,
              isHovered() && `translate-x-1`,
            )}
          />
        </div>
      </div>

      {/* Right image section */}
      <div
        class={`
          relative flex flex-col pt-8 pr-0 pb-0 pl-8
          lg:w-128 lg:pt-8 lg:pr-0 lg:pb-0 lg:pl-0
        `}
      >
        <div
          class={`
            relative h-48 w-full overflow-hidden rounded-tl-xl rounded-br-xl
            bg-white
            lg:h-auto lg:flex-1
          `}
        >
          <img
            src={props.image}
            alt={`${props.title} features`}
            class="h-full w-full object-cover"
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      {props.href ? (
        <a
          href={props.href}
          class={cardClass()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {cardContent()}
        </a>
      ) : (
        <div
          class={cardClass()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {cardContent()}
        </div>
      )}
    </>
  );
};
