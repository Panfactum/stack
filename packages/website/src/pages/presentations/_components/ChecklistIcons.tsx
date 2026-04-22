import type { Component } from "solid-js";

const iconStyle = {
  display: "inline-block",
  "vertical-align": "middle",
  "margin-right": "12px",
  "margin-top": "0.3em",
  "flex-shrink": "0",
};

export const XMark: Component = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97066"
    stroke-width="2.5"
    stroke-linecap="round"
    style={iconStyle}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke="#f97066"
      stroke-width="2"
    />
    <line x1="8" y1="8" x2="16" y2="16" />
    <line x1="16" y1="8" x2="8" y2="16" />
  </svg>
);

export const CheckMark: Component = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#32d583"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    style={iconStyle}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke="#32d583"
      stroke-width="2"
    />
    <polyline points="8,12.5 11,15.5 16,9" />
  </svg>
);

export const MinusMark: Component = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fdb022"
    stroke-width="2.5"
    stroke-linecap="round"
    style={iconStyle}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke="#fdb022"
      stroke-width="2"
    />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export const Checkbox: Component = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#85888e"
    stroke-width="2"
    style={iconStyle}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
  </svg>
);
