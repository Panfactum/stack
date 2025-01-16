export default function RootOrbitSVG_02() {
    return (
      <svg
      width="512"
      height="512"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <linearGradient
        id="a"
        gradientUnits="userSpaceOnUse"
        x1="54" x2="461"
        y1="108" y2="401"
      >
        <stop offset="0" stop-color="#1d3e4f" stop-opacity=".3"/>
        <stop offset="1" stop-color="#9ad3f1"/>
      </linearGradient>
    
      <g id="scene">
        <circle
          cx="256"
          cy="256"
          r="255"
          stroke="url(#a)"
          stroke-width="2"
          fill="none"
        />
    
        <g transform="translate(256, 1) scale(0.5) translate(-42, -42)">
          <circle 
            cx="42"
            cy="42"
            r="24"
            fill="#3b81b0"
            stroke="#153245"
            stroke-width="6"
          />
        </g>
    
        <g transform="translate(511, 256) scale(0.5) translate(-42, -42)">
          <circle 
            cx="42"
            cy="42"
            r="24"
            fill="#3b81b0"
            stroke="#153245"
            stroke-width="6"
          />
        </g>
    
        <g transform="translate(256, 511) scale(0.5) translate(-42, -42)">
          <circle 
            cx="42"
            cy="42"
            r="24"
            fill="#3b81b0"
            stroke="#153245"
            stroke-width="6"
          />
        </g>
    
        <g transform="translate(1, 256) scale(0.5) translate(-42, -42)">
          <circle 
            cx="42"
            cy="42"
            r="24"
            fill="#3b81b0"
            stroke="#153245"
            stroke-width="6"
          />
        </g>
      </g>
    
      
    </svg>
    
  
  
    )
  }
  /* 
  <animateTransform
        xlink:href="#scene"
        attributeName="transform"
        type="rotate"
        from="0 256 256"
        to="360 256 256"
        dur="20s"
        repeatCount="indefinite"
      /> */