import { FiMap } from "solid-icons/fi";
import { TbOutlineBolt, TbOutlineShieldCheck } from "solid-icons/tb";

import { NavItemWithPopup } from "../common/NavItemWithPopup";

export const ChangelogNavItem = () => {
  return (
    <NavItemWithPopup
      title="Changelog"
      action={() => (
        <nav>
          <ul class="space-y-4">
            <li>
              <a
                href="/docs/changelog/roadmap"
                class={`
                  flex items-center gap-3 text-display-xs font-bold
                  transition-colors
                  hover:text-secondary
                  focus-visible:outline-none
                `}
              >
                <FiMap size={20} />
                <span>Roadmap</span>
              </a>
            </li>
            <li>
              <a
                href="/docs/changelog/edge/0"
                class={`
                  flex items-center gap-3 text-display-xs font-bold
                  transition-colors
                  hover:text-secondary
                  focus-visible:outline-none
                `}
              >
                <TbOutlineBolt size={20} />
                <span>Edge</span>
              </a>
            </li>
            <li>
              <a
                href="/docs/changelog/stable.25-04/summary"
                class={`
                  flex items-center gap-3 text-display-xs font-bold
                  transition-colors
                  hover:text-secondary
                  focus-visible:outline-none
                `}
              >
                <TbOutlineShieldCheck size={20} />
                <span>Stable</span>
              </a>
            </li>
          </ul>
        </nav>
      )}
      saveEnabled={true}
    />
  );
};
