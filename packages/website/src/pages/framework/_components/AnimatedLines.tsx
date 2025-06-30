// Component that renders animated SVG lines emanating from the hero section
// Contains 4 lines with right-angle turns that animate outward after hero animations complete
import { toaster } from "@kobalte/core/toast";
import { clsx } from "clsx";
import type { Component } from "solid-js";
import {
  createSignal,
  onMount,
  Show,
  For,
  onCleanup,
  createEffect,
  createMemo,
} from "solid-js";

import Toast from "@/components/ui/Toast";

import styles from "./AnimatedLines.module.css";

// Configuration constants
const NUM_LINES = 20; // Number of animated lines to generate

// Funny messages for dot clicks
const FUNNY_MESSAGES_BASE = [
  "404: Personal boundaries not found",
  "I've been trying to reach you about your cluster's extended warranty",
  "ALERT: Hot singles in your area want to discuss container orchestration",
  "This dot runs on hopes, dreams, and unhandled rejections",
  "I'm serverless because I ghosted all my responsibilities",
  "WARNING: This dot may contain traces of legacy code",
  "You're turning me on... Please don't.",
  "Touch me like one your cluster dashbboards.",
  "I identify as a critical vulnerability but management says I'm a feature",
  "Local dot discovers this one weird trick to avoid garbage collection",
  "I'm not like other dots, I've read the documentation",
  "I'm a 10x dot but only between 2-3 AM on Tuesdays",
  "This interaction will be recorded for quality assurance and existential dread",
  "My parents wanted me to be a button, but here we are",
  "Currently accepting pull requests for my personality",
  "I peaked in beta and it's been downhill ever since",
  "Sir, this is a Kubernetes",
  "I'm just a dot standing in front of a user, asking them to love me",
  "My hobbies include long floats on the beach and avoiding merge conflicts",
  "Therapy is just debugging for humans, and I need a hotfix",
];

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Simple spatial index for efficient collision detection
class SpatialIndex {
  private segments: Map<string, Segment & { bounds: Bounds }> = new Map();
  private gridSize: number;
  private grid: Map<string, Set<string>> = new Map();

  constructor(gridSize: number = 50) {
    this.gridSize = gridSize;
  }

  private getBounds(segment: Segment): Bounds {
    return {
      minX: Math.min(segment.x1, segment.x2),
      minY: Math.min(segment.y1, segment.y2),
      maxX: Math.max(segment.x1, segment.x2),
      maxY: Math.max(segment.y1, segment.y2),
    };
  }

  private getGridKeys(bounds: Bounds): string[] {
    const keys: string[] = [];
    const startX = Math.floor(bounds.minX / this.gridSize);
    const endX = Math.floor(bounds.maxX / this.gridSize);
    const startY = Math.floor(bounds.minY / this.gridSize);
    const endY = Math.floor(bounds.maxY / this.gridSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }

  add(id: string, segment: Segment): void {
    const bounds = this.getBounds(segment);
    this.segments.set(id, { ...segment, bounds });

    const keys = this.getGridKeys(bounds);
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      const gridSet = this.grid.get(key);
      if (gridSet) {
        gridSet.add(id);
      }
    }
  }

  getPotentialCollisions(segment: Segment): Segment[] {
    const bounds = this.getBounds(segment);
    const keys = this.getGridKeys(bounds);
    const checked = new Set<string>();
    const results: Segment[] = [];

    for (const key of keys) {
      const cellSegments = this.grid.get(key);
      if (cellSegments) {
        for (const id of cellSegments) {
          if (!checked.has(id)) {
            checked.add(id);
            const stored = this.segments.get(id);
            if (stored) {
              results.push(stored);
            }
          }
        }
      }
    }
    return results;
  }
}

interface IAnimatedLinesProps {
  startAnimation: boolean;
  animationDuration?: number; // Duration in milliseconds, defaults to 700ms
  animationDelay?: number; // Delay before starting animation, defaults to 0ms
  onAllDotsClicked?: () => void; // Callback when all dots have been clicked
  hideAll?: boolean; // Hide all lines and dots
}

export const AnimatedLines: Component<IAnimatedLinesProps> = (props) => {
  // Shuffle messages once when component is created
  const FUNNY_MESSAGES = createMemo(() => shuffleArray(FUNNY_MESSAGES_BASE));

  const [isVisible, setIsVisible] = createSignal(false);
  const [showDots, setShowDots] = createSignal(false);
  const [mousePos, setMousePos] = createSignal({ x: 0, y: 0 });
  const [clickedDots, setClickedDots] = createSignal<Set<string>>(new Set());
  const [hasWon, setHasWon] = createSignal(false);
  const [terminalBounds, setTerminalBounds] = createSignal<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  }>({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });

  const [heroHeaderBounds, setHeroHeaderBounds] = createSignal<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  }>({ top: -200, bottom: 200, left: -400, right: 400 });

  const [_subtitleBounds, setSubtitleBounds] = createSignal<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  }>({ top: 0, bottom: 0, left: 0, right: 0 });

  const [linePaths, setLinePaths] = createSignal<
    Array<{
      id: string;
      path: string;
      color: string;
      endX: number;
      endY: number;
      pathLength: number;
      message: string;
    }>
  >(
    // Initialize with empty paths that will be updated once terminal is visible
    Array.from({ length: NUM_LINES }, (_, i) => ({
      id: `line${i + 1}`,
      path: "",
      color: `var(--color-brand-${[500, 400, 600, 500][i % 4]})`,
      endX: 0,
      endY: 0,
      pathLength: 1000,
      message: FUNNY_MESSAGES()[i % FUNNY_MESSAGES().length],
    })),
  );

  const [svgElement, setSvgElement] = createSignal<SVGSVGElement | undefined>(
    undefined,
  );

  // Default animation settings
  const animationDuration = () => props.animationDuration ?? 3000;
  const animationDelay = () => props.animationDelay ?? 0;

  // Calculate terminal position relative to SVG viewport
  const calculateTerminalPosition = () => {
    const terminal = document.getElementById("terminal-animation");
    const heroHeader = document.getElementById("hero-header");
    const heroSubtitle = document.getElementById("hero-subtitle");
    const svg = svgElement();
    if (!terminal || !svg || !heroHeader || !heroSubtitle) return;

    const terminalRect = terminal.getBoundingClientRect();
    const heroRect = heroHeader.getBoundingClientRect();

    // Convert screen coordinates to SVG coordinates
    const pt = svg.createSVGPoint();

    // Get the terminal bounds in SVG coordinates
    pt.x = terminalRect.left;
    pt.y = terminalRect.top;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return;
    const topLeft = pt.matrixTransform(screenCTM.inverse());

    pt.x = terminalRect.right;
    pt.y = terminalRect.bottom;
    const bottomRight = pt.matrixTransform(screenCTM.inverse());

    const newBounds = {
      top: topLeft.y,
      bottom: bottomRight.y,
      left: topLeft.x,
      right: bottomRight.x,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    setTerminalBounds(newBounds);

    // Calculate hero header bounds in SVG coordinates
    pt.x = heroRect.left;
    pt.y = heroRect.top;
    const heroTopLeft = pt.matrixTransform(screenCTM.inverse());

    pt.x = heroRect.right;
    pt.y = heroRect.bottom;
    const heroBottomRight = pt.matrixTransform(screenCTM.inverse());

    setHeroHeaderBounds({
      top: heroTopLeft.y,
      bottom: heroBottomRight.y,
      left: heroTopLeft.x,
      right: heroBottomRight.x,
    });

    // Calculate subtitle bounds in SVG coordinates
    const subtitleRect = heroSubtitle.getBoundingClientRect();

    pt.x = subtitleRect.left;
    pt.y = subtitleRect.top;
    const subtitleTopLeft = pt.matrixTransform(screenCTM.inverse());

    pt.x = subtitleRect.right;
    pt.y = subtitleRect.bottom;
    const subtitleBottomRight = pt.matrixTransform(screenCTM.inverse());

    const subtitleBoundsData = {
      top: subtitleTopLeft.y,
      bottom: subtitleBottomRight.y,
      left: subtitleTopLeft.x,
      right: subtitleBottomRight.x,
    };

    setSubtitleBounds(subtitleBoundsData);

    // Generate paths after calculating positions
    generateLinePaths();
  };

  // Helper function to check if a segment intersects with existing segments using spatial index
  const checkSegmentIntersection = (
    newSegment: Segment,
    spatialIndex: SpatialIndex,
    segmentId: string,
  ): boolean => {
    const potentialCollisions = spatialIndex.getPotentialCollisions(newSegment);

    for (const { x1, y1, x2, y2 } of potentialCollisions) {
      if (
        checkLineIntersectsRectangle(
          newSegment,
          {
            top: Math.min(y1, y2),
            bottom: Math.max(y1, y2),
            left: Math.min(x1, x2),
            right: Math.max(x1, x2),
          },
          15,
          `${segmentId}-segment`,
        )
      ) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check if a line segment intersects with any avoidance area (subtitle or terminal)
  const checkLineIntersectsAvoidanceAreas = (
    segment: Segment,
    spatialIndex: SpatialIndex,
    segmentId: string = "",
  ) => {
    // Check terminal intersection
    const terminalIntersects = checkLineIntersectsRectangle(
      segment,
      terminalBounds(),
      25, // buffer,
      `${segmentId}-terminal`,
    );

    return (
      terminalIntersects ||
      checkSegmentIntersection(segment, spatialIndex, segmentId)
    );
  };

  // Helper function to check if a line segment intersects with a rectangle
  const checkLineIntersectsRectangle = (
    segment: Segment,
    bounds: { top: number; bottom: number; left: number; right: number },
    buffer: number,
    _segmentId: string = "",
  ) => {
    const left = bounds.left - buffer;
    const right = bounds.right + buffer;
    const top = bounds.top - buffer;
    const bottom = bounds.bottom + buffer;
    const { x1, y1, x2, y2 } = segment;

    const point2Inside = x2 > left && x2 < right && y2 > top && y2 < bottom;

    if (point2Inside) {
      return true;
    }

    // Check if line passes completely through the rectangle (both endpoints outside but line crosses)
    // This handles cases where line starts outside one side and ends outside the opposite side
    const lineMinX = Math.min(x1, x2);
    const lineMaxX = Math.max(x1, x2);
    const lineMinY = Math.min(y1, y2);
    const lineMaxY = Math.max(y1, y2);

    // Check if line spans across the rectangle in either direction
    const spansHorizontally = lineMinX <= left && lineMaxX >= right;
    const spansVertically = lineMinY <= top && lineMaxY >= bottom;
    const crossesHorizontally = lineMinX < right && lineMaxX > left;
    const crossesVertically = lineMinY < bottom && lineMaxY > top;

    if (
      (spansHorizontally && crossesVertically) ||
      (spansVertically && crossesHorizontally)
    ) {
      return true;
    }

    // Use simple bounding box check - if bounding boxes don't overlap, definitely no intersection
    const lineLeft = Math.min(x1, x2);
    const lineRight = Math.max(x1, x2);
    const lineTop = Math.min(y1, y2);
    const lineBottom = Math.max(y1, y2);

    // If line bounding box doesn't overlap rectangle, no intersection possible
    if (
      lineRight < left ||
      lineLeft > right ||
      lineBottom < top ||
      lineTop > bottom
    ) {
      return false;
    }

    // If we reach here, bounding boxes overlap, so we need to check for actual intersection

    // Check actual line-rectangle intersection using parametric approach
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Handle degenerate case
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
      return false;
    }

    let tEnter = 0.0;
    let tExit = 1.0;

    // Check against each boundary
    const boundaries = [
      { normal: [-1, 0], d: -left }, // Left boundary: -x + left = 0
      { normal: [1, 0], d: right }, // Right boundary: x - right = 0
      { normal: [0, -1], d: -top }, // Top boundary: -y + top = 0
      { normal: [0, 1], d: bottom }, // Bottom boundary: y - bottom = 0
    ];

    for (const boundary of boundaries) {
      const numerator =
        boundary.d - (boundary.normal[0] * x1 + boundary.normal[1] * y1);
      const denominator = boundary.normal[0] * dx + boundary.normal[1] * dy;

      if (Math.abs(denominator) < 0.0001) {
        // Line is parallel to boundary
        if (numerator < 0) {
          // Line is completely outside this boundary
          return false;
        }
        // Line is parallel but inside/on boundary, continue to next boundary
      } else {
        const t = numerator / denominator;
        if (denominator > 0) {
          // Line is entering the half-space
          tEnter = Math.max(tEnter, t);
        } else {
          // Line is exiting the half-space
          tExit = Math.min(tExit, t);
        }

        if (tEnter > tExit) {
          // No intersection
          return false;
        }
      }
    }

    // Check if intersection occurs within the line segment
    const intersects = tEnter <= 1.0 && tExit >= 0.0;

    return intersects;
  };

  // Generate line paths based on terminal position
  const generateLinePaths = () => {
    const bounds = terminalBounds();
    const minSegmentLength = 25; // Minimum distance between turns
    const heroBounds = heroHeaderBounds();

    // Check if we have valid bounds
    if (bounds.width === 0 || bounds.height === 0) {
      return; // Don't generate paths if terminal bounds not calculated yet
    }

    // Define endpoints for the lines (within hero header bounds with margin)
    const endpoints: Array<{ x: number; y: number }> = [];

    // Define startpoints to make sure all lines start at different spots
    const startpoints: Array<{ x: number; y: number }> = [];

    // Create spatial index for efficient collision detection
    const spatialIndex = new SpatialIndex(50);

    // Generate all paths using the simplified algorithm
    const paths = [];
    for (let lineIndex = 0; lineIndex < NUM_LINES; lineIndex++) {
      const points: Array<{ x: number; y: number }> = [];
      const centerY = bounds.top + bounds.height / 2;
      const centerX = bounds.left + bounds.width / 2;

      let startX = 0;
      let startY = 0;
      let startDirection = 0;
      for (let i = 0; i < 100; i++) {
        // Randomly choose left or right side of terminal to start from
        startDirection =
          Math.random() < 0.7
            ? Math.random() < 0.5
              ? 1
              : 3
            : Math.random() < 0.5
              ? 0
              : 2;

        if (startDirection === 3 || startDirection === 1) {
          startY = startDirection === 3 ? bounds.bottom + 2 : bounds.top - 2;
          for (let j = 0; j < 100; j++) {
            startX = centerX + (Math.random() - 0.5) * bounds.width;
            if (!startpoints.some(({ x }) => Math.abs(x - startX) <= 20)) {
              break;
            }
          }
        } else {
          startX = startDirection === 0 ? bounds.left - 2 : bounds.right + 2;
          for (let j = 0; j < 100; j++) {
            startY = centerY + (Math.random() - 0.5) * bounds.height;
            if (!startpoints.some(({ y }) => Math.abs(y - startY) <= 4)) {
              break;
            }
          }
        }

        if (startX !== 0 && startY !== 0) {
          break;
        }
      }

      if (startX === 0 || startY === 0) {
        continue;
      }

      // Start from terminal
      let currentX = startX;
      let currentY = startY;

      points.push({ x: currentX, y: currentY });

      // Generate 4-6 random segments
      const numSegments = 4 + Math.floor(Math.random() * 3);
      let lastDirection = startDirection;
      let turnCounter = 0;

      // Chooses the next direction to turn
      const getNextTurn = () => {
        const turn = Math.random() < 0.5 ? 1 : -1;
        // This ensures that we do not loop back on ourselves
        if (turnCounter + turn <= -3 || turnCounter + turn >= 3) {
          return -turn;
        } else {
          return turn;
        }
      };

      const getNextDirection = () => {
        // If this is the first segment, we are either going to go left or right
        if (points.length === 1) {
          return { direction: startDirection, turn: 0 };
        } else {
          const turn = getNextTurn();
          const rawDirection = lastDirection + turn;
          if (rawDirection < 0) {
            return { direction: rawDirection + 4, turn };
          } else if (rawDirection >= 4) {
            return { direction: rawDirection - 4, turn };
          } else {
            return { direction: rawDirection, turn };
          }
        }
      };

      for (let i = 0; i < numSegments; i++) {
        let segmentAttempts = 0;

        // Try up to 20 times to generate a valid segment
        while (segmentAttempts < 100) {
          // Record the attempt
          segmentAttempts++;

          // Choose the segment direction (random)
          const { direction, turn } = getNextDirection();

          // Random segment length
          const segmentLength = minSegmentLength * (1 + Math.random() * 10);

          let newX;
          let newY;
          if (direction === 0) {
            newX = currentX - segmentLength;
            if (newX < heroBounds.left + 20) {
              continue;
            }
            newY = currentY;
          } else if (direction === 1) {
            newX = currentX;
            newY = currentY - segmentLength;
            if (newY < heroBounds.top + 20) {
              continue;
            }
          } else if (direction === 2) {
            newX = currentX + segmentLength;
            if (newX > heroBounds.right - 20) {
              continue;
            }
            newY = currentY;
          } else {
            newX = currentX;
            newY = currentY + segmentLength;
            if (newY > heroBounds.bottom - 20) {
              continue;
            }
          }

          // Check if this segment intersects with any avoidance areas
          const segment: Segment = {
            x1: currentX,
            y1: currentY,
            x2: newX,
            y2: newY,
          };
          const segmentIntersects = checkLineIntersectsAvoidanceAreas(
            segment,
            spatialIndex,
            `L${lineIndex + 1}S${i + 1}-attempt${segmentAttempts + 1}`,
          );

          if (!segmentIntersects) {
            currentX = newX;
            currentY = newY;
            // Add segment to spatial index
            spatialIndex.add(`L${lineIndex}-S${i}`, segment);
            points.push({ x: currentX, y: currentY });
            lastDirection = direction;
            turnCounter += turn;
            break;
          }
        }
      }

      if (points.length > 1) {
        paths.push(
          points
            .map((point, i) =>
              i === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
            )
            .join(" "),
        );
        startpoints.push(points[0]);
        endpoints.push(points[points.length - 1]);
      }
    }

    const pathData = paths.map((path, i) => {
      // Calculate actual path length
      const tempPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      tempPath.setAttribute("d", path);
      const pathLength = tempPath.getTotalLength();

      return {
        id: `line${i + 1}`,
        path: path,
        color: `var(--color-brand-800)`,
        endX: endpoints[i]?.x || 0,
        endY: endpoints[i]?.y || 0,
        pathLength: pathLength,
        message: FUNNY_MESSAGES()[i % FUNNY_MESSAGES().length],
      };
    });

    setLinePaths(pathData);
  };

  // Show dots after line animation completes
  createEffect(() => {
    if (props.startAnimation) {
      const totalDelay = animationDelay() + animationDuration();
      setTimeout(() => setShowDots(true), totalDelay + 100);
    }
  });

  // Check if all dots have been clicked
  createEffect(() => {
    const paths = linePaths();
    if (showDots() && paths.length > 0 && !hasWon()) {
      // Only count clicks for dots that actually exist
      const validClickedDots = Array.from(clickedDots()).filter((dotId) =>
        paths.some((path) => path.id === dotId),
      );

      // Only trigger win if all current dots are clicked (not based on old clicked state)
      if (validClickedDots.length === paths.length) {
        setHasWon(true);
        props.onAllDotsClicked?.();
      }
    }
  });

  // On initial render, ensure at least one dot is unclicked
  onMount(() => {
    const paths = linePaths();
    // If somehow all dots start clicked, unclick one randomly
    if (paths.length > 0 && clickedDots().size === paths.length) {
      const clickedArray = Array.from(clickedDots());
      const randomIndex = Math.floor(Math.random() * clickedArray.length);
      const newClickedSet = new Set(clickedArray);
      newClickedSet.delete(clickedArray[randomIndex]);
      setClickedDots(newClickedSet);
    }
  });

  // Recalculate position when animation starts
  createEffect(() => {
    const svg = svgElement();
    if (svg && props.startAnimation) {
      // Wait for terminal to be visible and layout to settle
      let retryCount = 0;
      const maxRetries = 50; // Prevent infinite loop

      const checkAndCalculate = () => {
        const terminal = document.getElementById("terminal-animation");
        const heroSubtitle = document.getElementById("hero-subtitle");

        if (terminal && heroSubtitle) {
          const terminalRect = terminal.getBoundingClientRect();
          const subtitleRect = heroSubtitle.getBoundingClientRect();
          const parentDiv = terminal.closest(".md\\:flex");
          const parentOpacity = parentDiv
            ? window.getComputedStyle(parentDiv).opacity
            : "1";

          // Check subtitle opacity to ensure it's fully visible
          const subtitleOpacity = window.getComputedStyle(heroSubtitle).opacity;

          // Check if both terminal and subtitle are visible and have dimensions
          if (
            terminalRect.width > 0 &&
            terminalRect.height > 0 &&
            terminalRect.top < window.innerHeight &&
            terminalRect.bottom > 0 &&
            parseFloat(parentOpacity) > 0.9 &&
            subtitleRect.width > 0 &&
            subtitleRect.height > 0 &&
            parseFloat(subtitleOpacity) > 0.9
          ) {
            // Both elements are visible, calculate position
            calculateTerminalPosition();
          } else if (retryCount < maxRetries) {
            // Retry if not yet fully visible
            retryCount++;
            setTimeout(checkAndCalculate, 100); // Check every 100ms for more time
          } else {
            calculateTerminalPosition();
          }
        } else if (retryCount < maxRetries) {
          // Retry if elements not found
          retryCount++;
          setTimeout(checkAndCalculate, 100);
        }
      };

      // Start checking after a short delay to ensure DOM is ready
      setTimeout(checkAndCalculate, 100);
    }
  });

  // Calculate distance between mouse and dot in SVG coordinates
  const calculateDistance = (dotX: number, dotY: number) => {
    const svg = svgElement();
    if (!svg) return Infinity;

    const mouse = mousePos();
    const pt = svg.createSVGPoint();
    pt.x = mouse.x;
    pt.y = mouse.y;

    // Convert mouse coordinates to SVG coordinates
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return Infinity;
    const svgMouse = pt.matrixTransform(screenCTM.inverse());

    // Calculate distance
    const dx = svgMouse.x - dotX;
    const dy = svgMouse.y - dotY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Update hovered dots based on mouse position
  const hoveredDotsSet = createMemo(() => {
    if (!showDots()) return new Set<string>();

    const paths = linePaths();
    const newHoveredDots = new Set<string>();

    // Trigger reactivity on mouse position
    mousePos();

    paths.forEach((line) => {
      if (line.path && line.endX && line.endY) {
        const distance = calculateDistance(line.endX, line.endY);
        if (distance <= 50) {
          newHoveredDots.add(line.id);
        }
      }
    });

    return newHoveredDots;
  });

  // Handle dot click
  const handleDotClick = (lineId: string, message: string) => {
    // Add the clicked dot to the set
    setClickedDots((prev) => new Set([...prev, lineId]));

    const toastID = toaster.show((props) => (
      <Toast id={props.toastId} title={message} />
    ));

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      toaster.dismiss(toastID);
    }, 2000);
  };

  onMount(() => {
    // Component is mounted and ready
    setIsVisible(true);

    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Recalculate on window resize
    const handleResize = () => {
      if (svgElement() && document.getElementById("terminal-animation")) {
        calculateTerminalPosition();
      }
    };
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    });
  });

  return (
    <Show when={isVisible()}>
      <div
        class={clsx(
          "absolute inset-0",
          `
            hidden
            md:block
          `, // Hidden on mobile
        )}
        style={{
          "z-index": "1", // Behind all other content
          contain: "layout style paint", // CSS containment for performance
        }}
      >
        <svg
          ref={setSvgElement}
          class="absolute inset-0 h-full w-full opacity-45"
          viewBox="-400 -200 800 400"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
          aria-hidden="true"
          style={{
            "will-change": props.startAnimation ? "transform" : "auto",
            "pointer-events": "none",
            opacity: props.hideAll ? "0" : "0.45",
            transition: "opacity 500ms ease-out",
          }}
        >
          <defs>
            {/* Define gradients and other reusable elements */}
            <linearGradient
              id="lineGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                stop-color="var(--color-brand-400)"
                stop-opacity="0.8"
              />
              <stop
                offset="100%"
                stop-color="var(--color-brand-600)"
                stop-opacity="0.4"
              />
            </linearGradient>
          </defs>
          <g id="animatedLines">
            <For each={linePaths()}>
              {(line) => (
                <g id={line.id}>
                  {/* Path for the line */}
                  <Show when={line.path}>
                    <path
                      d={line.path}
                      stroke={line.color}
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class={clsx(
                        styles.pathDraw,
                        props.startAnimation && styles.pathDrawAnimate,
                      )}
                      style={{
                        "--animation-duration": `${animationDuration()}ms`,
                        "--animation-delay": `${animationDelay()}ms`,
                        "--path-length": line.pathLength,
                      }}
                    />
                  </Show>
                  {/* Circle placeholder at the end */}
                  <Show when={line.path && showDots()}>
                    <circle
                      cx={line.endX}
                      cy={line.endY}
                      r={clickedDots().has(line.id) ? "8" : "5"}
                      fill={
                        clickedDots().has(line.id)
                          ? "#FFEB3B" // Brighter gold for clicked dots
                          : hoveredDotsSet().has(line.id)
                            ? "#FFD700" // Standard gold for hover
                            : line.color
                      }
                      class={styles.dotFadeIn}
                      style={{
                        transition:
                          "fill 200ms ease-in-out, r 200ms ease-in-out",
                        cursor:
                          hoveredDotsSet().has(line.id) ||
                          !clickedDots().has(line.id)
                            ? "pointer"
                            : "default",
                        "pointer-events": "all",
                      }}
                      onClick={() => {
                        handleDotClick(line.id, line.message);
                      }}
                    />
                  </Show>
                </g>
              )}
            </For>
          </g>
        </svg>
      </div>
    </Show>
  );
};
