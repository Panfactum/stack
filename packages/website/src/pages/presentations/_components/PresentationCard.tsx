// Presentation card component for listing page
// Displays title, date, author, and optional thumbnail with link to full presentation
import { Image } from "@unpic/solid";
import { clsx } from "clsx";
import { type Component } from "solid-js";

interface IPresentationCardProps {
  title: string;
  date: string;
  author: string;
  slug: string;
  thumbnail?: string;
}

export const PresentationCard: Component<IPresentationCardProps> = (props) => {
  return (
    <a
      href={`/presentations/${props.slug}`}
      class={clsx(
        "block rounded-lg bg-secondary p-6",
        "border border-primary",
        `
          transition-all
          hover:-translate-y-1 hover:border-brand-600 hover:shadow-lg
          hover:shadow-gray-dark-mode-950/50
        `,
      )}
    >
      {/* Thumbnail or placeholder */}
      <div
        class={`mb-4 aspect-video w-full overflow-hidden rounded-md bg-tertiary`}
      >
        {props.thumbnail ? (
          <Image
            src={props.thumbnail}
            alt={`${props.title} thumbnail`}
            class="h-full w-full object-cover"
            layout="fullWidth"
          />
        ) : (
          <div
            class={`
              flex h-full w-full items-center justify-center text-tertiary
            `}
          >
            <svg
              class="h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 class="mb-2 font-machina text-display-sm font-bold text-primary">
        {props.title}
      </h3>

      {/* Metadata */}
      <div class="flex flex-col gap-1 text-sm text-secondary">
        <div class="flex items-center gap-2">
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{props.date}</span>
        </div>
        <div class="flex items-center gap-2">
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>{props.author}</span>
        </div>
      </div>
    </a>
  );
};
