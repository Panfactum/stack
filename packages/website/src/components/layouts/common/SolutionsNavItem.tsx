import { AutopilotMarkIcon } from "@/components/icons/AutopilotMarkIcon";
import { FrameworkMarkIcon } from "@/components/icons/FrameworkMarkIcon";

import { NavItemWithPopup } from "../common/NavItemWithPopup";

export const SolutionsNavItem = () => {
  return (
    <NavItemWithPopup
      title="Solutions"
      action={() => (
        <nav>
          <ul class="space-y-4">
            <li>
              <a
                href="/framework"
                class={`
                  flex items-center gap-3 text-display-xs font-bold
                  transition-colors
                  hover:text-secondary
                  focus-visible:outline-none
                `}
              >
                <FrameworkMarkIcon size={24} />
                <span>Framework</span>
                <span
                  class={`
                    ml-2 rounded-full bg-gray-dark-mode-800 px-2 py-0.5 text-xs
                    font-medium text-gray-dark-mode-300
                  `}
                >
                  Open-source
                </span>
              </a>
            </li>
            <li>
              <a
                href="/autopilot"
                class={`
                  flex items-center gap-3 text-display-xs font-bold
                  transition-colors
                  hover:text-secondary
                  focus-visible:outline-none
                `}
              >
                <AutopilotMarkIcon size={24} />
                <span>Autopilot</span>
                <span
                  class={`
                    ml-2 rounded-full bg-gray-dark-mode-800 px-2 py-0.5 text-xs
                    font-medium text-gray-dark-mode-300
                  `}
                >
                  Managed
                </span>
              </a>
            </li>
          </ul>
        </nav>
      )}
      saveEnabled={true}
    />
  );
};
