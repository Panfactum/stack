// Bare Metal feature panel component
// Placeholder content for the Bare Metal cost optimization feature
import { type Component } from "solid-js";

export const BareMetal: Component = () => {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="mb-2 text-2xl font-bold">Bare Metal Infrastructure</h2>
        <p class="text-secondary">
          Deploy directly to bare metal servers for maximum cost efficiency and
          performance.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-lg bg-tertiary p-4">
          <div class="text-3xl font-bold text-brand-400">65%</div>
          <div class="text-sm text-secondary">Cost Reduction</div>
        </div>
        <div class="rounded-lg bg-tertiary p-4">
          <div class="text-3xl font-bold text-green-400">2.3x</div>
          <div class="text-sm text-secondary">Performance Gain</div>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold">Key Benefits</h3>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <span class="mt-1 text-brand-400">•</span>
            <span class="text-sm">Eliminate virtualization overhead</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 text-brand-400">•</span>
            <span class="text-sm">
              Direct hardware access for critical workloads
            </span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 text-brand-400">•</span>
            <span class="text-sm">Predictable performance characteristics</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg bg-tertiary p-4">
        <h4 class="mb-2 text-sm font-semibold">Example Configuration</h4>
        <pre class="overflow-x-auto text-xs text-gray-dark-mode-300">
          {`resource "metal_server" "app" {
  plan     = "c3.medium.x86"
  metro    = "sv"
  os       = "ubuntu_20_04"
}`}
        </pre>
      </div>
    </div>
  );
};
