import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import ClusterCountDescription from "@/pages/_components/PriceCalculator/ClusterCountDescription.tsx";
import {getAdjustedPrice} from "@/pages/_components/PriceCalculator/calculatePlanPrice.ts";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";
import InputRowPrice from "@/pages/_components/inputs/InputRowPrice.tsx";
import {CLUSTER_COST} from "@/pages/_components/priceConstants.ts";

const ClusterCountInput: Component = () => {
    return (
      <>
        <IntegerInput
          id={"cluster-count"}
          label={`# of Clusters`}
          description={ClusterCountDescription}
          value={calculatorStore.clusterCount}
          max={1000}
          onChange={(newVal) => {
            setCalculatorStore("clusterCount", newVal);
          }}
        />
        <InputRowPrice price={getAdjustedPrice(CLUSTER_COST, calculatorStore)}/>
      </>
    );
};

export default ClusterCountInput;
