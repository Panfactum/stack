// Side-by-side pie chart comparison for Reveal.js presentations.
// Supports area-based scaling so one pie can be visually larger than another.
import { ArcElement, Chart, PieController, Tooltip } from "chart.js";
import { clsx } from "clsx";
import { For, Show, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

Chart.register(PieController, ArcElement, Tooltip);

interface ISegment {
  label: string;
  color: string;
}

interface IPieData {
  label: string;
  values: number[];
  scale?: number;
}

interface IPieChartComparisonProps {
  segments: ISegment[];
  pies: IPieData[];
  caption?: string;
}

export const PieChartComparison: Component<IPieChartComparisonProps> = (
  props,
) => {
  const canvasRefs: Map<number, HTMLCanvasElement> = new Map();
  const chartInstances: Chart[] = [];

  onMount(() => {
    props.pies.forEach((pie, pieIndex) => {
      const canvas = canvasRefs.get(pieIndex);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const chart = new Chart(ctx, {
        type: "pie",
        data: {
          labels: props.segments.map((s) => s.label),
          datasets: [
            {
              data: pie.values,
              backgroundColor: props.segments.map((s) => s.color),
              borderWidth: 2,
              borderColor: "#0c111d",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1f242f",
              titleColor: "#f5f5f6",
              bodyColor: "#cecfd2",
              borderColor: "#333741",
              borderWidth: 1,
              titleFont: { family: "Neue Machina, sans-serif" },
              bodyFont: { family: "Inter, sans-serif" },
              callbacks: {
                label: (context) => {
                  const label = context.label;
                  const value = context.parsed;
                  return ` ${label}: ${String(value)}%`;
                },
              },
            },
          },
        },
      });

      chartInstances.push(chart);
    });
  });

  onCleanup(() => {
    chartInstances.forEach((chart) => {
      chart.destroy();
    });
  });

  const maxScale = () => Math.max(...props.pies.map((p) => p.scale ?? 1));

  return (
    <div
      class={clsx("flex w-full flex-col items-center")}
      style={{ gap: "20px" }}
    >
      {/* Charts row */}
      <div
        class={clsx("flex w-full items-center justify-center")}
        style={{ height: "420px", gap: "140px" }}
      >
        <For each={props.pies}>
          {(pie, index) => {
            const scale = pie.scale ?? 1;
            const diameterRatio = Math.sqrt(scale / maxScale());

            return (
              <div
                class={clsx("flex flex-col items-center")}
                style={{
                  height: `${String(diameterRatio * 100)}%`,
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    flex: "1",
                    "aspect-ratio": "1",
                    "min-height": "0",
                  }}
                >
                  <canvas
                    ref={(el) => {
                      canvasRefs.set(index(), el);
                    }}
                  />
                </div>
                <span
                  style={{
                    color: "#f5f5f6",
                    "font-family": "Neue Machina, sans-serif",
                    "font-weight": "bold",
                    "font-size": "24px",
                    "flex-shrink": "0",
                  }}
                >
                  {pie.label}
                </span>
              </div>
            );
          }}
        </For>
      </div>

      {/* Shared legend */}
      <div
        class={clsx("flex flex-wrap justify-center")}
        style={{ gap: "8px 20px" }}
      >
        <For each={props.segments}>
          {(segment) => (
            <div class={clsx("flex items-center")} style={{ gap: "6px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  "border-radius": "3px",
                  "background-color": segment.color,
                  "flex-shrink": "0",
                }}
              />
              <span
                style={{
                  color: "#cecfd2",
                  "font-family": "Inter, sans-serif",
                  "font-size": "16px",
                }}
              >
                {segment.label}
              </span>
            </div>
          )}
        </For>
      </div>

      {/* Optional caption */}
      <Show when={props.caption}>
        <span
          style={{
            color: "#94969c",
            "font-family": "Inter, sans-serif",
            "font-size": "22px",
            "font-style": "italic",
          }}
        >
          {props.caption}
        </span>
      </Show>
    </div>
  );
};
