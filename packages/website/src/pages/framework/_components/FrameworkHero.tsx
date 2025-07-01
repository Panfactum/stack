// Main hero section component for the framework page
// Contains hero header and integrates features section
import type { Component } from "solid-js";
import { For, onMount, createSignal, Show } from "solid-js";

import { AnimatedLines } from "./AnimatedLines";
import { FeaturesSection } from "./FeaturesSection";
import { TerminalAnimation } from "./TerminalAnimation";

export const FrameworkHero: Component = () => {
  const [animationStarted, setAnimationStarted] = createSignal(false);
  const [subtitleVisible, setSubtitleVisible] = createSignal(false);
  const [terminalVisible, setTerminalVisible] = createSignal(false);
  const [startTyping, setStartTyping] = createSignal(false);
  const [startLineAnimation, setStartLineAnimation] = createSignal(false);
  const [showYouWin, setShowYouWin] = createSignal(false);

  let h1Ref: HTMLHeadingElement | undefined;

  const titleWords = [
    { text: "How ", isHighlighted: false },
    { text: "engineers ", isHighlighted: false },
    { text: "build", isHighlighted: true },
    { text: "successful ", isHighlighted: true },
    { text: "cloud ", isHighlighted: true },
    { text: "platforms", isHighlighted: true },
  ];

  onMount(() => {
    // Start title animation after component mounts
    setTimeout(() => setAnimationStarted(true), 100);

    // Start subtitle fade
    setTimeout(() => setSubtitleVisible(true), 650);

    // Start terminal fade after subtitle begins
    setTimeout(() => setTerminalVisible(true), 1100);

    // Start typing after terminal is fully visible (1100ms + 700ms fade = 1800ms)
    setTimeout(() => setStartTyping(true), 1800);

    // Start line animations after typing completes
    // Typing starts at 1800ms and takes ~1700ms (68 chars * 25ms/char)
    setTimeout(() => setStartLineAnimation(true), 3500);
  });

  return (
    <section
      class={`
        relative overflow-hidden bg-primary py-8
        md:py-24
      `}
    >
      <div
        class={`
          relative z-10 mx-auto max-w-screen-2xl px-6
          md:px-10
          lg:px-16
        `}
      >
        {/* Hero Header */}
        <div class="relative py-24 text-center" id="hero-header">
          <h1
            ref={h1Ref}
            class={`
              relative z-10 mb-2 font-machina text-4xl leading-tight font-bold
              md:text-6xl
              lg:text-7xl
            `}
            style={{
              "text-shadow":
                "0 4px 20px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.7)",
              "pointer-events": "none",
              "user-select": "text",
            }}
          >
            <Show
              when={!showYouWin()}
              fallback={
                <span class="animate-pulse text-brand-400">You win!</span>
              }
            >
              <For each={titleWords}>
                {(word, index) => (
                  <>
                    <span
                      class={`
                        inline-block transition-all duration-700 ease-out
                        ${
                          animationStarted()
                            ? "translate-y-0 opacity-100"
                            : "translate-y-8 opacity-0"
                        }
                        ${word.isHighlighted ? "text-brand-400" : ""}
                        ${word.text === "successful " ? "block" : ""}
                      `}
                      style={{
                        "transition-delay": `${index() * 150}ms`,
                      }}
                    >
                      {word.text.trim()}
                    </span>
                    {word.text === "build" && (
                      <>
                        <br
                          class={`
                            hidden
                            md:block
                          `}
                        />
                        <span class="md:hidden"> </span>
                      </>
                    )}
                    {word.text !== "platforms" && word.text !== "build" && " "}
                  </>
                )}
              </For>
            </Show>
          </h1>
          <p
            id="hero-subtitle"
            class={`
              relative z-10 mx-auto mb-8 w-fit max-w-4xl text-display-sm
              text-primary transition-opacity duration-[1500ms]
              ${subtitleVisible() ? "opacity-100" : "opacity-0"}
            `}
            style={{
              "text-shadow":
                "0 2px 10px rgba(0, 0, 0, 0.4), 0 1px 5px rgba(0, 0, 0, 0.6)",
              "pointer-events": "none",
              "user-select": "text",
            }}
          >
            <Show
              when={!showYouWin()}
              fallback={
                <>
                  Email <span class="text-brand-400">jack@panfactum.com</span>{" "}
                  with the subject line{" "}
                  <span class="text-brand-400">"I won!"</span> for your prize.
                </>
              }
            >
              The single framework to deploy, manage, extend, and scale your
              cloud platform.
            </Show>
          </p>

          {/* Mobile Buttons */}
          <div
            class={`
              mb-8 flex flex-row items-center justify-center gap-4
              transition-opacity duration-700 ease-out
              md:hidden
              ${terminalVisible() ? "opacity-100" : "opacity-0"}
            `}
          >
            <a
              href="/docs/edge/guides/getting-started/overview"
              class={`
                inline-flex items-center rounded-lg border border-brand-400 px-4
                py-3 text-sm font-semibold text-brand-400 transition-colors
                hover:bg-brand-400 hover:text-white
              `}
            >
              Get started
            </a>
            <a
              href="https://calendly.com/panfactum/30min"
              target="_blank"
              rel="noopener noreferrer"
              class={`
                inline-flex items-center rounded-lg bg-brand-400 px-4 py-3
                text-sm font-semibold text-white transition-colors
                hover:bg-brand-700
              `}
            >
              Talk to a human
            </a>
          </div>

          <div
            class={`
              relative z-10 mx-auto hidden w-fit items-center justify-center
              gap-2 text-secondary transition-opacity duration-700 ease-out
              md:flex
              ${terminalVisible() ? "opacity-100" : "opacity-0"}
            `}
          >
            <span>Get started:</span>
            <TerminalAnimation startTyping={startTyping()} />
          </div>

          {/* Animated Lines */}
          <AnimatedLines
            startAnimation={startLineAnimation()}
            onAllDotsClicked={() => setShowYouWin(true)}
            hideAll={showYouWin()}
          />
        </div>

        {/* Features Section */}
        <FeaturesSection />
      </div>
    </section>
  );
};
