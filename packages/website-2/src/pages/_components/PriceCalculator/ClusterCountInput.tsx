import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import ClusterCountDescription from "@/pages/_components/PriceCalculator/ClusterCountDescription.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";

const ClusterCountInput: Component = () => {
  return (
    <IntegerInput
      id={"cluster-count"}
      label={"Number of Kubernetes Clusters"}
      description={ClusterCountDescription}
      value={calculatorStore.clusterCount}
      max={1000}
      onChange={(newVal) => {
        setCalculatorStore("clusterCount", newVal);
      }}
    />
  );
};

export default ClusterCountInput;
