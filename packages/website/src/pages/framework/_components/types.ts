// Type definitions for the framework hero component
// Defines interfaces for features, categories, and stages
import type { IconTypes } from "solid-icons";
import type { Component } from "solid-js";

export type Stage = "Stable" | "Beta" | "Alpha" | "Roadmap";

export interface Feature {
  id: string;
  name: string;
  component: Component;
  stage: Stage;
  icon: IconTypes;
}

export interface FeatureCategory {
  name: string;
  features: Feature[];
}