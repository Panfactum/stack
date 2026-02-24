// Presentation viewer component - handles fullscreen toggle UI,
// PDF download, and navigation controls for Reveal.js presentations
import { clsx } from "clsx";
import { FiDownload, FiMaximize2, FiMinimize2 } from "solid-icons/fi";
import {
  Show,
  type Component,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

interface IPresentationViewerProps {
  title: string;
  isPrintPdf: boolean;
}

export const PresentationViewer: Component<IPresentationViewerProps> = (
  props,
) => {
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    const container = document.getElementById("presentation-container");
    if (!container) return;

    const deck = (window as unknown as Record<string, unknown>).Reveal as
      | {
          configure: (opts: Record<string, unknown>) => void;
          layout: () => void;
        }
      | undefined;

    if (!isFullscreen()) {
      // Enter fullscreen
      container.classList.add("fullscreen-mode");
      document.body.classList.add("presentation-fullscreen");
      setIsFullscreen(true);

      // Disable embedded mode so Reveal.js shows controls, progress, and slide numbers
      if (deck) {
        deck.configure({ embedded: false });
        deck.layout();
      }
    } else {
      // Exit fullscreen
      container.classList.remove("fullscreen-mode");
      document.body.classList.remove("presentation-fullscreen");
      setIsFullscreen(false);

      // Re-enable embedded mode for the inline view
      if (deck) {
        deck.configure({ embedded: true });
        deck.layout();
      }
    }
  };

  // Handle escape key to exit fullscreen
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen()) {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Generate a PDF by capturing each slide with an overlay to hide cycling
  const downloadPdf = async () => {
    if (isDownloading()) return;
    setIsDownloading(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const deck = (window as unknown as Record<string, unknown>).Reveal as
        | {
            getTotalSlides: () => number;
            getIndices: () => { h: number; v: number };
            slide: (h: number, v: number) => void;
            getSlidesElement: () => HTMLElement;
            configure: (options: Record<string, unknown>) => void;
          }
        | undefined;

      if (!deck) return;

      const slidesElement = deck.getSlidesElement();
      const totalSlides = deck.getTotalSlides();
      const originalIndices = deck.getIndices();

      // Place an opaque overlay on top of the presentation to hide cycling
      const revealEl = slidesElement.closest<HTMLElement>(".reveal");
      if (!revealEl) return;

      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:absolute;inset:0;z-index:100;display:flex;" +
        "align-items:center;justify-content:center;" +
        "background:#0c111d;color:#f5f5f6;font-size:18px;font-family:Inter,sans-serif;";
      overlay.textContent = "Generating PDF...";
      revealEl.style.position = "relative";
      revealEl.appendChild(overlay);

      // Disable transitions while capturing
      deck.configure({ transition: "none" });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1280, 720],
      });

      for (let i = 0; i < totalSlides; i++) {
        deck.slide(i, 0);

        // Allow Reveal.js to render the slide beneath the overlay
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add padding to the active slide for print capture
        const activeSlide =
          slidesElement.querySelector<HTMLElement>("section.present");
        if (activeSlide) {
          activeSlide.style.padding = "40px 60px";
          activeSlide.style.boxSizing = "border-box";
        }

        // html2canvas reads the DOM tree of slidesElement directly,
        // so the sibling overlay does not interfere with capture
        const canvas = await html2canvas(slidesElement, {
          width: 1280,
          height: 720,
          scale: 2,
          useCORS: true,
          backgroundColor: "#0c111d",
        });

        // Remove the temporary padding
        if (activeSlide) {
          activeSlide.style.padding = "";
          activeSlide.style.boxSizing = "";
        }

        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, 1280, 720);
      }

      // Clean up: remove overlay, restore position and transition
      revealEl.removeChild(overlay);
      deck.configure({ transition: "slide" });
      deck.slide(originalIndices.h, originalIndices.v);

      const filename =
        props.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "presentation";

      pdf.save(`${filename}.pdf`);
    } catch (error) {
      // eslint-disable-next-line no-console -- User-facing error for PDF generation failure
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Show when={!props.isPrintPdf}>
      {/* eslint-disable better-tailwindcss/no-unregistered-classes -- CSS hook for presentation toolbar */}
      <div
        class={clsx(
          "presentation-controls",
          "flex items-center justify-between gap-4 px-4 py-3",
          "border-b border-primary bg-secondary",
          isFullscreen()
            ? "fixed top-0 right-0 left-0 z-50"
            : "relative mb-4 rounded-t-lg",
        )}
      >
        {/* Title */}
        <h1
          class={`
            text-lg font-semibold text-primary
            md:text-xl
          `}
        >
          {props.title}
        </h1>

        {/* Controls */}
        <div class="flex items-center gap-2">
          {/* Download PDF Button */}
          <button
            onClick={() => void downloadPdf()}
            disabled={isDownloading()}
            class={clsx(
              "flex items-center gap-2",
              "rounded-md border border-primary bg-tertiary",
              `
                p-2 text-sm font-medium text-primary
                md:px-3 md:py-1.5
              `,
              `
                transition-colors
                hover:border-brand-400 hover:bg-accent
              `,
              isDownloading() && "cursor-wait opacity-60",
            )}
            title="Download presentation as PDF"
          >
            <FiDownload size={18} />
            <span
              class={`
                hidden
                md:inline
              `}
            >
              {isDownloading() ? "Generating..." : "Download PDF"}
            </span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            class={clsx(
              "flex items-center gap-2",
              "rounded-md border border-primary bg-tertiary",
              `
                p-2 text-sm font-medium text-primary
                md:px-3 md:py-1.5
              `,
              `
                transition-colors
                hover:border-brand-400 hover:bg-accent
              `,
            )}
            title={
              isFullscreen()
                ? "Exit fullscreen mode (Esc)"
                : "Enter fullscreen presentation mode"
            }
          >
            {isFullscreen() ? (
              <>
                <FiMinimize2 size={18} />
                <span
                  class={`
                    hidden
                    md:inline
                  `}
                >
                  Back to Site
                </span>
              </>
            ) : (
              <>
                <FiMaximize2 size={18} />
                <span
                  class={`
                    hidden
                    md:inline
                  `}
                >
                  Go Fullscreen
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* eslint-enable better-tailwindcss/no-unregistered-classes */}
    </Show>
  );
};
