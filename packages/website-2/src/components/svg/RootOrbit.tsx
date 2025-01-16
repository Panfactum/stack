export default function RootOrbitSVG() {
    return (
      <svg
    width="512"
    height="512"
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <linearGradient
      id="a"
      gradientUnits="userSpaceOnUse"
      x1="54" x2="461" y1="108" y2="401"
    >
      <stop offset="0" stop-color="#1d3e4f" stop-opacity=".3"/>
      <stop offset="1" stop-color="#9ad3f1"/>
    </linearGradient>
  
    <g>
      <circle
        cx="256"
        cy="256"
        r="255"
        stroke="url(#a)"
        stroke-width="2"
        fill="none"
      />
  
      <circle
        cx="256"
        cy="1"
        r="10"
        fill="url(#a)"
      />
      <circle
        cx="511"
        cy="256"
        r="10"
        fill="url(#a)"
      />
      <circle
        cx="256"
        cy="511"
        r="10"
        fill="url(#a)"
      />
      <circle
        cx="1"
        cy="256"
        r="10"
        fill="url(#a)"
      />
  
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 256 256"
        to="360 256 256"
        dur="20s"
        repeatCount="indefinite"
      />
    </g>
  </svg>
  
    )
  }