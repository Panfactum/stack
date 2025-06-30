// Interactive table component for displaying comparisons between Panfactum and alternatives
// Features responsive design with CSS Grid layout and semantic Tailwind styling
import { For, type Component } from "solid-js";

import { PanfactumLogoIcon } from "@/components/icons/PanfactumLogoIcon";

// Comparison data structure interface
interface ComparisonItem {
  criterion: string;
  hireContract: string;
  legacyAgency: string;
  panfactum: string;
}

interface ComparisonTableProps {
  data: ComparisonItem[];
}

export const ComparisonTable: Component<ComparisonTableProps> = (props) => {
  return (
    <div class="overflow-hidden bg-primary">
      {/* Table container with responsive layout */}
      <div class="overflow-x-auto">
        <div class="mx-auto max-w-screen-2xl">
          <table class="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {/* Empty header cell */}
                <th class="bg-primary p-4" />
                {/* Column headers */}
                <th
                  class={`
                    rounded-tl-xl border-t border-r border-l border-secondary
                    bg-accent p-4 text-center
                    lg:px-8 lg:py-5
                  `}
                >
                  <div class="flex items-center justify-center">
                    <PanfactumLogoIcon
                      class={`
                        h-6 w-auto
                        lg:h-7
                      `}
                    />
                  </div>
                </th>
                <th
                  class={`
                    border-t border-r border-secondary bg-secondary p-4
                    text-center
                    lg:px-8 lg:py-5
                  `}
                >
                  <h3
                    class={`
                      text-base font-medium whitespace-nowrap text-secondary
                      lg:text-lg
                    `}
                  >
                    DIY
                  </h3>
                </th>
                <th
                  class={`
                    rounded-tr-xl border-t border-r border-secondary
                    bg-secondary p-4 text-center
                    lg:px-8 lg:py-5
                  `}
                >
                  <h3
                    class={`
                      text-base font-medium whitespace-nowrap text-secondary
                      lg:text-lg
                    `}
                  >
                    Agency
                  </h3>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={props.data}>
                {(item, index) => (
                  <tr>
                    {/* Criterion column */}
                    <td
                      class={`
                        border-t border-r border-l border-secondary p-4
                        lg:px-8 lg:py-5
                        ${index() === 0 ? "rounded-tl-xl" : ""}
                        ${
                          index() === props.data.length - 1
                            ? "rounded-bl-xl border-b"
                            : ""
                        }
                      `}
                    >
                      <span
                        class={`
                          text-sm font-medium whitespace-nowrap text-primary
                          lg:text-base
                        `}
                      >
                        {item.criterion}
                      </span>
                    </td>

                    {/* Panfactum column (highlighted) */}
                    <td
                      class={`
                        border-t border-r border-secondary bg-accent p-4
                        text-center
                        lg:px-8 lg:py-5
                        ${index() === props.data.length - 1 ? "border-b" : ""}
                      `}
                    >
                      <span
                        class={`
                          text-sm font-medium whitespace-nowrap text-primary
                          lg:text-base
                        `}
                      >
                        {item.panfactum}
                      </span>
                    </td>

                    {/* Hire/Contract column */}
                    <td
                      class={`
                        border-t border-r border-secondary p-4 text-center
                        lg:px-8 lg:py-5
                        ${index() === props.data.length - 1 ? "border-b" : ""}
                      `}
                    >
                      <span
                        class={`
                          text-sm whitespace-nowrap text-secondary
                          lg:text-base
                        `}
                      >
                        {item.hireContract}
                      </span>
                    </td>

                    {/* Legacy Agency column */}
                    <td
                      class={`
                        border-t border-r border-secondary p-4 text-center
                        lg:px-8 lg:py-5
                        ${
                          index() === props.data.length - 1
                            ? "rounded-br-xl border-b"
                            : ""
                        }
                      `}
                    >
                      <span
                        class={`
                          text-sm whitespace-nowrap text-secondary
                          lg:text-base
                        `}
                      >
                        {item.legacyAgency}
                      </span>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
