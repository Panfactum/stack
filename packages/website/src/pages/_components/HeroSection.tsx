// Hero section component with animated gradient text, interactive grid background, and scrolling testimonials
// Displays main value proposition with CTAs and social proof elements
import { Image } from "@unpic/solid";
import { clsx } from "clsx";
import { RiLogosLinkedinFill } from "solid-icons/ri";
import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  For,
  type Component,
} from "solid-js";

import { ShimmerButton } from "@/components/ui/ShimmerButton";

import styles from "./HeroSection.module.css";
// Import avatar images
import hudsonLogo from "./images/hudson.png";
import implentioLogo from "./images/implentio.png";
import jeffKellerAvatar from "./images/jeff-keller.png";
import joshLevyAvatar from "./images/josh-levy.png";
import mattSnowAvatar from "./images/matt-snow.png";
import selflesslyLogo from "./images/selflessly.png";
import wesBragaAvatar from "./images/wes-braga.png";

// Hero content constants
const TITLE = "Reclaim Your Cloud!";

const DESCRIPTION = "Launch faster. Scale easier. Save 90%.";

const PRIMARY_CTA = {
  text: "Book a Demo",
  href: "https://app.reclaim.ai/m/panfactum/panfactum-demo",
};

const SECONDARY_CTA = {
  text: "Open Source",
  href: "https://github.com/panfactum/stack",
};

// Default testimonials configuration
const TESTIMONIALS: Array<{
  text: string;
  author: {
    name: string;
    title: string;
    avatar: string;
    linkedinUrl: string;
  };
  companyLogo: string;
  invertLogo?: boolean;
}> = [
  {
    text: "We would be paying AWS close to 15 grand for the size database that we have and now we pay 500 bucks for the same compute power.",
    author: {
      name: "Wes Braga",
      title: "Platform Engineer",
      avatar: wesBragaAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/wesbragagt/",
    },
    companyLogo: implentioLogo.src,
    invertLogo: true,
  },

  {
    text: "With Panfactum, I don't think we'll ever need like a platform team.",
    author: {
      name: "Joshua Levy",
      title: "Head of Engineering",
      avatar: joshLevyAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/joshuamlevy/",
    },
    companyLogo: hudsonLogo.src,
  },
  {
    text: "Setting up AWS is not where my time is best spent. Thanks to Panfactum, we can focus on shipping.",
    author: {
      name: "Jeff Keller",
      title: "CTO",
      avatar: jeffKellerAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/jeffkellerindy/",
    },
    companyLogo: selflesslyLogo.src,
    invertLogo: true,
  },
  {
    text: "I would have spent the whole year of setup on AWS - I spent two days bootstrapping the Panfactum stack and told my coworkers, hey, let's start deploying.",
    author: {
      name: "Wes Braga",
      title: "Platform Engineer",
      avatar: wesBragaAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/wesbragagt/",
    },
    companyLogo: implentioLogo.src,
    invertLogo: true,
  },
  {
    text: "We're paying less for an environment that is more robust, more easy to monitor, more scalable, falls over less, easier to put up and spin down.",
    author: {
      name: "Joshua Levy",
      title: "Head of Engineering",
      avatar: joshLevyAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/joshuamlevy/",
    },
    companyLogo: hudsonLogo.src,
  },
  {
    text: "One of the biggest benefits of Panfactum  is that we can spend time working on our customers' issues and not our own, it's a huge weight off of our shoulders.",
    author: {
      name: "Matt Snow",
      title: "Platform Engineer",
      avatar: mattSnowAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/mschnee/",
    },
    companyLogo: implentioLogo.src,
    invertLogo: true,
  },
  {
    text: "The cost savings are so extreme that we are paying more per month for DataDog than AWS.",
    author: {
      name: "Joshua Levy",
      title: "Head of Engineering",
      avatar: joshLevyAvatar.src,
      linkedinUrl: "https://www.linkedin.com/in/joshuamlevy/",
    },
    companyLogo: hudsonLogo.src,
  },
];

interface IHeroSectionProps {
  // Empty interface for future extensibility
}

// Testimonial item component
interface ITestimonialItemProps {
  text: string;
  author: {
    name: string;
    title: string;
    avatar: string;
    linkedinUrl?: string;
  };
  companyLogo: string;
  invertLogo?: boolean;
}

const TestimonialItem: Component<ITestimonialItemProps> = (props) => (
  <div
    class={clsx(
      `
        flex flex-col gap-4
        md:gap-6
      `,
      `
        px-6 py-4 whitespace-normal
        md:py-6
      `,
      `
        w-full
        md:w-112
        lg:w-128
      `,
    )}
  >
    {/* Company logo - shown at top on mobile, hidden on larger screens */}
    <Image
      src={props.companyLogo}
      alt="Company"
      width={160}
      height={60}
      class={clsx(
        `
          h-14 w-32 self-center object-contain opacity-70 grayscale
          md:hidden md:self-start
        `,
        props.invertLogo && "invert",
      )}
    />

    {/* Testimonial quote */}
    <blockquote
      class={`
        text-center text-lg leading-relaxed font-medium text-secondary
        md:text-left
      `}
    >
      "{props.text}"
    </blockquote>

    {/* Author info with company logo (on larger screens) */}
    <div
      class={`
        flex items-center justify-center gap-4
        md:justify-start
      `}
    >
      <div class="flex items-center gap-3">
        <Image
          src={props.author.avatar}
          alt={props.author.name}
          width={40}
          height={40}
          class="h-10 w-10 rounded-full object-cover"
        />
        <div class="flex items-center gap-6">
          <div class="flex flex-col items-start">
            <span class="text-sm font-semibold text-primary">
              {props.author.name}
            </span>
            <span class="text-left text-xs text-secondary">
              {props.author.title}
            </span>
          </div>
          {props.author.linkedinUrl ? (
            <a
              href={props.author.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              class={`
                group flex items-center justify-center rounded-full border-2
                border-brand-400 p-1 transition-all
                hover:border-brand-400 hover:bg-brand-400
              `}
            >
              <RiLogosLinkedinFill
                class={`
                  h-5 w-5 text-brand-400 transition-colors
                  group-hover:text-white
                `}
              />
            </a>
          ) : (
            <div
              class={`
                flex items-center justify-center rounded-full border-2
                border-brand-400 p-1 opacity-50
              `}
            >
              <RiLogosLinkedinFill class="h-5 w-5 text-brand-400" />
            </div>
          )}
        </div>
      </div>

      {/* Vertical divider - only on larger screens */}
      <div
        class={`
          hidden h-10 w-px bg-gray-dark-mode-700
          md:block
        `}
      />

      {/* Company logo - only on larger screens */}
      <Image
        src={props.companyLogo}
        alt="Company"
        width={120}
        height={60}
        class={clsx(
          `
            hidden h-14 w-28 object-contain opacity-70 grayscale
            md:block
          `,
          props.invertLogo && "invert",
        )}
      />
    </div>
  </div>
);

export const HeroSection: Component<IHeroSectionProps> = () => {
  // Mouse position state
  const [mouseX, setMouseX] = createSignal(0);
  const [mouseY, setMouseY] = createSignal(0);
  const [gridOpacity, setGridOpacity] = createSignal(0);

  // Carousel state for mobile
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isTransitioning, setIsTransitioning] = createSignal(false);

  // Handler for mouse movement
  const handleMouseMove = (e: MouseEvent) => {
    // Store both local and global coordinates
    setMouseX(e.clientX); // Use global X for full-width grid
    setMouseY(e.clientY); // Use global Y for grid highlight
    setGridOpacity(1);
  };

  // Handler for mouse leave
  const handleMouseLeave = () => {
    setGridOpacity(0);
  };

  // Update CSS variables when mouse position changes
  createEffect(() => {
    // For full-width grid, convert pixel coordinates to percentages
    const mouseXPercent = (mouseX() / window.innerWidth) * 100;
    const rect = document
      .querySelector(`.${styles.heroSection}`)
      ?.getBoundingClientRect();
    // Adjust for the grid's actual position and height (140% of hero section)
    const gridTop = rect ? rect.top - 10 : 0; // Grid starts 10px above hero section
    const mouseYLocal = mouseY() - gridTop;
    const gridHeight = rect ? rect.height * 1.4 : window.innerHeight; // Grid is 140% height
    const mouseYPercent = (mouseYLocal / gridHeight) * 100;

    document.documentElement.style.setProperty(
      "--mouse-x",
      `${mouseXPercent}%`,
    );
    document.documentElement.style.setProperty(
      "--mouse-y",
      `${mouseYPercent}%`,
    );
    document.documentElement.style.setProperty(
      "--grid-opacity",
      `${gridOpacity()}`,
    );
  });

  // Setup mouse event listeners on mount
  onMount(() => {
    const heroSection = document.querySelector(`.${styles.heroSection}`);

    if (heroSection) {
      heroSection.addEventListener(
        "mousemove",
        handleMouseMove as EventListener,
      );
      heroSection.addEventListener("mouseleave", handleMouseLeave);
    }

    // Auto-advance carousel on mobile
    const interval = setInterval(() => {
      if (window.innerWidth < 768 && !isTransitioning()) {
        // Only on mobile
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
        setTimeout(() => setIsTransitioning(false), 500);
      }
    }, 4000); // Change every 4 seconds

    // Cleanup
    onCleanup(() => {
      clearInterval(interval);
      if (heroSection) {
        heroSection.removeEventListener(
          "mousemove",
          handleMouseMove as EventListener,
        );
        heroSection.removeEventListener("mouseleave", handleMouseLeave);
      }
    });
  });

  return (
    <section
      class={clsx(
        styles.heroSection,
        `
          relative mx-auto max-w-screen-2xl px-6 pt-12 pb-0
          md:pt-40 md:pb-20
        `,
        "md:px-10",
        "lg:px-16",
      )}
    >
      <div class={styles.gridBackground}>
        {/* Generate fewer dots for better performance */}
        <For each={Array.from({ length: 40 }, (_, i) => i)}>
          {(i) => {
            // Keep dots on gridlines but vary their horizontal starting positions
            const gridLine = i % 20; // Even distribution across 20 grid lines
            const speed = 48 + ((i * 7) % 32); // 48-80s

            // Much wider delay spread for better horizontal distribution
            // This creates the effect of dots being spread out along the line
            const delay = ((i * 17) % 200) - 100; // -100 to 100s delay

            // Variable trail length between 40-80px
            const trailLength = 40 + ((i * 13) % 40);

            return (
              <div
                class={clsx(styles.gridDot, styles.dotHorizontal)}
                style={{
                  "--dot-position": `${gridLine * 62}px`,
                  "--dot-offset": `${(gridLine - 10) * 62}px`,
                  "--dot-speed": `${speed}s`,
                  "--dot-delay": `${delay}s`,
                  "--trail-length": `${trailLength}px`,
                }}
              />
            );
          }}
        </For>
      </div>
      <div
        class={`
          pointer-events-none relative z-10 flex flex-col items-center gap-6
          text-center
        `}
      >
        <h1
          class={clsx(
            styles.animateFadeUp,
            "max-w-4xl font-machina text-5xl leading-tight font-bold",
            "text-white opacity-0",
            "md:text-6xl",
            "lg:text-7xl",
          )}
          style={{
            "animation-fill-mode": "forwards",
            "animation-delay": "0.2s",
          }}
        >
          {TITLE}
        </h1>
        <p
          class={clsx(
            styles.animateFadeUp,
            "max-w-3xl text-xl font-semibold text-gray-light-mode-200 opacity-0",
            "md:text-2xl",
            "lg:text-3xl",
          )}
          style={{
            "animation-fill-mode": "forwards",
            "animation-delay": "0.6s",
          }}
        >
          {DESCRIPTION}
        </p>
        <div
          class={clsx(
            styles.animateFadeUp,
            "mt-8 flex flex-row gap-3 opacity-0",
          )}
          style={{
            "animation-fill-mode": "forwards",
            "animation-delay": "0.8s",
          }}
        >
          <a
            href={SECONDARY_CTA.href}
            class={clsx(
              `
                rounded-lg border border-gray-dark-mode-700
                bg-gray-dark-mode-800 px-4 py-2.5 text-sm
              `,
              "pointer-events-auto text-gray-light-mode-300 transition-all",
              `
                hover:border-gray-dark-mode-600 hover:bg-gray-dark-mode-700
                hover:text-white
              `,
              "sm:px-6 sm:py-3 sm:text-base",
            )}
          >
            {SECONDARY_CTA.text}
          </a>
          <ShimmerButton
            href={PRIMARY_CTA.href}
            class={`
              text-sm font-bold
              sm:text-base
            `}
          >
            {PRIMARY_CTA.text}
          </ShimmerButton>
        </div>

        {/* Scrolling Testimonials */}
        <div
          class={clsx(
            styles.animateFadeUp,
            `
              pointer-events-auto mt-12 w-full max-w-screen-3xl overflow-hidden
              opacity-0
              md:mt-20
            `,
          )}
          style={{
            "animation-delay": "1.1s",
            "animation-fill-mode": "forwards",
          }}
        >
          <div class="relative w-full">
            {/* Gradient overlays for smooth fade effect - only on desktop */}
            <div
              class={clsx(
                "pointer-events-none absolute top-0 left-0 z-20 h-full w-32",
                "bg-gradient-to-r from-gray-dark-mode-950 to-transparent",
                `
                  hidden
                  md:block
                `,
              )}
            />
            <div
              class={clsx(
                "pointer-events-none absolute top-0 -right-2 z-20 h-full w-32",
                "bg-gradient-to-l from-gray-dark-mode-950 to-transparent",
                `
                  hidden
                  md:block
                `,
              )}
            />

            {/* Mobile carousel - visible on small screens */}
            <div
              class={`
                block
                md:hidden
              `}
            >
              <div class="flex gap-4">
                {/* Vertical carousel indicators on the left */}
                <div class="flex flex-col justify-center gap-2">
                  <For each={TESTIMONIALS}>
                    {(_, index) => (
                      <button
                        class={clsx(
                          "h-2 w-2 rounded-full transition-all",
                          index() === currentIndex()
                            ? "h-8 w-2 bg-brand-400"
                            : "bg-gray-dark-mode-600",
                        )}
                        onClick={() => {
                          setIsTransitioning(true);
                          setCurrentIndex(index());
                          setTimeout(() => setIsTransitioning(false), 500);
                        }}
                      />
                    )}
                  </For>
                </div>

                {/* Testimonial content */}
                <div class="relative flex-1 overflow-hidden">
                  <div
                    class={clsx(
                      "flex transition-transform duration-500 ease-in-out",
                      isTransitioning() && "transform",
                    )}
                    style={{
                      transform: `translateX(-${currentIndex() * 100}%)`,
                    }}
                  >
                    <For each={TESTIMONIALS}>
                      {(testimonial) => (
                        <div class="w-full flex-shrink-0">
                          <TestimonialItem
                            text={testimonial.text}
                            author={testimonial.author}
                            companyLogo={testimonial.companyLogo}
                            invertLogo={testimonial.invertLogo}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop scrolling container - visible on larger screens */}
            <div
              class={clsx(
                styles.testimonialScroll,
                `
                  hidden w-max items-center gap-8
                  md:flex
                `,
              )}
            >
              {/* First set of testimonials */}
              <For each={TESTIMONIALS}>
                {(testimonial) => (
                  <TestimonialItem
                    text={testimonial.text}
                    author={testimonial.author}
                    companyLogo={testimonial.companyLogo}
                    invertLogo={testimonial.invertLogo}
                  />
                )}
              </For>

              {/* Duplicate set for seamless infinite scroll */}
              <For each={TESTIMONIALS}>
                {(testimonial) => (
                  <TestimonialItem
                    text={testimonial.text}
                    author={testimonial.author}
                    companyLogo={testimonial.companyLogo}
                    invertLogo={testimonial.invertLogo}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
