declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    'breakpoints'?: number[];
  }
}

// Type declarations for Reveal.js modules
declare module 'reveal.js' {
  export interface RevealOptions {
    embedded?: boolean;
    hash?: boolean;
    slideNumber?: boolean;
    controls?: boolean;
    controlsBackArrows?: 'faded' | 'hidden' | 'visible';
    progress?: boolean;
    center?: boolean;
    width?: number;
    height?: number;
    margin?: number;
    minScale?: number;
    maxScale?: number;
    plugins?: unknown[];
    highlight?: {
      highlightOnLoad?: boolean;
    };
    keyboard?: Record<number, () => void>;
    transition?: string;
  }

  export interface RevealPlugin {
    open?: () => void;
  }

  export default class Reveal {
    constructor(options?: RevealOptions);
    constructor(element: HTMLElement, options?: RevealOptions);
    initialize(): Promise<void>;
    configure(options: Partial<RevealOptions>): void;
    layout(): void;
    destroy(): void;
    on(event: string, callback: (event: Record<string, unknown>) => void): void;
    getPlugin(name: string): RevealPlugin | null;
    getTotalSlides(): number;
    getIndices(): { h: number; v: number };
    slide(h: number, v: number): void;
    getSlidesElement(): HTMLElement;
  }
}

declare module 'reveal.js/plugin/highlight/highlight' {
  const RevealHighlight: unknown;
  export default RevealHighlight;
}

declare module 'reveal.js/plugin/notes/notes' {
  const RevealNotes: unknown;
  export default RevealNotes;
}

declare module 'reveal.js/dist/reveal.css' {
  const css: string;
  export default css;
}

declare module 'reveal.js/plugin/highlight/monokai.css' {
  const css: string;
  export default css;
}