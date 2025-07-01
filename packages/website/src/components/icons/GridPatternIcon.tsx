// Grid pattern icon component for background patterns and decorative elements
// Grid lines pattern rendered as a SolidJS component with responsive sizing
import type { Component } from "solid-js";

interface GridPatternIconProps {
  class?: string;
  size?: string | number;
}

export const GridPatternIcon: Component<GridPatternIconProps> = (props) => {
  return (
    <svg
      width={props.size || "100%"}
      viewBox="0 0 1440 1274"
      fill="none"
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.2">
        <mask
          id="mask0_128_69526"
          style={{ "mask-type": "alpha" }}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1440"
          height="1440"
        >
          <rect
            width="1440"
            height="1440"
            fill="url(#paint0_radial_128_69526)"
          />
        </mask>
        <g mask="url(#mask0_128_69526)">
          <g clip-path="url(#clip0_128_69526)">
            <g clip-path="url(#clip1_128_69526)">
              <line x1="48.5" x2="48.5" y2="1440" stroke="#D0D8DD" />
              <line x1="144.5" x2="144.5" y2="1440" stroke="#D0D8DD" />
              <line x1="240.5" x2="240.5" y2="1440" stroke="#D0D8DD" />
              <line x1="336.5" x2="336.5" y2="1440" stroke="#D0D8DD" />
              <line x1="432.5" x2="432.5" y2="1440" stroke="#D0D8DD" />
              <line x1="528.5" x2="528.5" y2="1440" stroke="#D0D8DD" />
              <line x1="624.5" x2="624.5" y2="1440" stroke="#D0D8DD" />
              <line x1="720.5" x2="720.5" y2="1440" stroke="#D0D8DD" />
              <line x1="816.5" x2="816.5" y2="1440" stroke="#D0D8DD" />
              <line x1="912.5" x2="912.5" y2="1440" stroke="#D0D8DD" />
              <line x1="1008.5" x2="1008.5" y2="1440" stroke="#D0D8DD" />
              <line x1="1104.5" x2="1104.5" y2="1440" stroke="#D0D8DD" />
              <line x1="1200.5" x2="1200.5" y2="1440" stroke="#D0D8DD" />
              <line x1="1296.5" x2="1296.5" y2="1440" stroke="#D0D8DD" />
              <line x1="1392.5" x2="1392.5" y2="1440" stroke="#D0D8DD" />
            </g>
            <g clip-path="url(#clip2_128_69526)">
              <line x1="-240" y1="95.5" x2="1680" y2="95.5" stroke="#D0D8DD" />
              <line
                x1="-240"
                y1="191.5"
                x2="1680"
                y2="191.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="287.5"
                x2="1680"
                y2="287.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="383.5"
                x2="1680"
                y2="383.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="479.5"
                x2="1680"
                y2="479.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="575.5"
                x2="1680"
                y2="575.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="671.5"
                x2="1680"
                y2="671.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="767.5"
                x2="1680"
                y2="767.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="863.5"
                x2="1680"
                y2="863.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="959.5"
                x2="1680"
                y2="959.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="1055.5"
                x2="1680"
                y2="1055.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="1151.5"
                x2="1680"
                y2="1151.5"
                stroke="#D0D8DD"
              />
              <line
                x1="-240"
                y1="1247.5"
                x2="1680"
                y2="1247.5"
                stroke="#D0D8DD"
              />
            </g>
          </g>
        </g>
      </g>
      <defs>
        <radialGradient
          id="paint0_radial_128_69526"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(720 -0.000171661) rotate(90) scale(1440 751.588)"
        >
          <stop />
          <stop offset="0.953125" stop-opacity="0" />
        </radialGradient>
        <clipPath id="clip0_128_69526">
          <rect
            width="1920"
            height="1440"
            fill="white"
            transform="translate(-240)"
          />
        </clipPath>
        <clipPath id="clip1_128_69526">
          <rect
            width="1920"
            height="1440"
            fill="white"
            transform="translate(-240)"
          />
        </clipPath>
        <clipPath id="clip2_128_69526">
          <rect
            width="1920"
            height="1440"
            fill="white"
            transform="translate(-240)"
          />
        </clipPath>
      </defs>
    </svg>
  );
};
