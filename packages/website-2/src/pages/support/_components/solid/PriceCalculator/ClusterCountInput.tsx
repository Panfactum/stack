import type { Component } from "solid-js";

import { IntegerInput } from "@/components/solid/inputs/IntegerInput.tsx";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/support/_components/calculatorStore.ts";
import ClusterCountDescription from "@/pages/support/_components/solid/PriceCalculator/ClusterCountDescription.tsx";

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
