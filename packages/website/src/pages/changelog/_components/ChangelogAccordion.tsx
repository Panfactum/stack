/* eslint-disable solid/no-innerhtml */

import { Accordion } from "@kobalte/core/accordion";
import { parseFromString } from "dom-parser";
import { FiPlusCircle } from "solid-icons/fi";
import { For, type Component } from "solid-js";

import { getNameFromId } from "./getNameFromId";

export interface ChangelogEntry {
  id: string;
  content: string;
  summary: string;
  skip: boolean;
}

const countElementsByDataAttribute = (
  content: string,
  attribute: string,
): number => {
  try {
    // Use dom-parser instead of DOMParser
    const dom = parseFromString(`<div id="wrapper">${content}</div>`);

    // Find the element with our data attribute
    const container = dom
      .getElementsByTagName("div")
      .find((el) => el.getAttribute(`data-${attribute}`));
    if (!container) return 0;

    // Get only the direct li children, not nested ones
    const allLiElements = container.getElementsByTagName("li");
    const directLiElements = Array.from(allLiElements).filter((li) => {
      // Check if this li is directly within a list that's a child of the container
      const parentList = li.parentNode;
      if (!parentList) return false;

      // Check if the parent list is within one or two levels of the container
      // This handles both <div><ul><li> and <div><div><ul><li> patterns
      const listParent = parentList.parentNode;
      if (!listParent) return false;

      return listParent === container || listParent.parentNode === container;
    });

    return directLiElements.length;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error parsing content:", error);
    return 0;
  }
};

const countBreakingChanges = (content: string): number => {
  return countElementsByDataAttribute(content, "breaking-changes");
};

const countFixes = (content: string): number => {
  return countElementsByDataAttribute(content, "fixes");
};

const countChanges = (content: string): number => {
  return countElementsByDataAttribute(content, "changes");
};

const countAdditions = (content: string): number => {
  return countElementsByDataAttribute(content, "additions");
};

interface ChangelogAccordionProps {
  entries: ChangelogEntry[];
}

export const ChangelogAccordion: Component<ChangelogAccordionProps> = (
  props,
) => {
  return (
    <Accordion multiple collapsible class="w-full">
      <For each={props.entries}>
        {(entry, index) => {
          const breakingChangesCount = countBreakingChanges(entry.content);
          const fixesCount = countFixes(entry.content);
          const changesCount = countChanges(entry.content);
          const additionsCount = countAdditions(entry.content);

          return (
            <Accordion.Item
              value={`entry-${index()}`}
              class="group w-full overflow-hidden rounded-lg"
            >
              <Accordion.Trigger class="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-1 text-left font-medium transition-colors duration-200 [&[data-expanded]_svg]:rotate-45">
                <div class="flex w-full flex-col gap-1">
                  <div class="flex flex-wrap items-center justify-start gap-x-4 gap-y-1">
                    <FiPlusCircle class="mt-1 w-6 transition-all" size={24} />
                    <h2 class="!m-0 !border-0 text-xl font-medium">
                      {getNameFromId(entry.id)}
                    </h2>
                    {entry.skip ? (
                      <span class=" ml-2 font-semibold">❌</span>
                    ) : (
                      <div class="flex gap-4">
                        {breakingChangesCount > 0 && (
                          <span class=" text-nowrap font-semibold">
                            {breakingChangesCount} ⚠️
                          </span>
                        )}
                        {fixesCount > 0 && (
                          <span class=" text-nowrap font-semibold">
                            {fixesCount} 🛠️
                          </span>
                        )}
                        {changesCount > 0 && (
                          <span class=" text-nowrap font-semibold">
                            {changesCount} 🔄
                          </span>
                        )}
                        {additionsCount > 0 && (
                          <span class=" text-nowrap font-semibold">
                            {additionsCount} ✨
                          </span>
                        )}
                      </div>
                    )}
                    <a
                      class="ml-auto hidden text-nowrap sm:inline"
                      href={`/changelog/${entry.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      Direct Link
                    </a>
                  </div>
                  <p class="!my-0 ml-10 italic">{entry.summary}</p>
                </div>
              </Accordion.Trigger>

              <Accordion.Content class="overflow-hidden pl-12 data-[closed]:animate-kobalte-collapsible-up data-[expanded]:animate-kobalte-collapsible-down">
                <div innerHTML={entry.content} />
              </Accordion.Content>
            </Accordion.Item>
          );
        }}
      </For>
    </Accordion>
  );
};
