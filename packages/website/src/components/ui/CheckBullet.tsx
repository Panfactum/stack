// Check bullet component with blue circle and white check mark
// Standard UI component for indicating completed items or included features
import { type ParentComponent } from "solid-js";

export const CheckBullet: ParentComponent = (props) => (
  <li class="flex items-start gap-3">
    <div
      class={`
        mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center
        rounded-full bg-brand-600
      `}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M7.75 12L10.58 14.83L16.25 9.17"
          stroke="white"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <span class="text-secondary">{props.children}</span>
  </li>
);
