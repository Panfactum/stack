import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import CustomWorkloadCountDescription from "@/pages/_components/PriceCalculator/CustomWorkloadCountDescription.tsx";
import {getAdjustedPrice} from "@/pages/_components/PriceCalculator/calculatePlanPrice.ts";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";
import InputRowPrice from "@/pages/_components/inputs/InputRowPrice.tsx";
import {CUSTOM_WORKLOAD_DEPLOYMENT_COST} from "@/pages/_components/priceConstants.ts";

const CustomWorkloadCountInput: Component = () => {
  return (
    <>
      <IntegerInput
      id={"workload-count"}
      label={"# of Custom Workloads"}
      description={CustomWorkloadCountDescription}
      value={calculatorStore.workloadCount}
      max={1000}
      onChange={(newVal) => {
        setCalculatorStore("workloadCount", newVal);
      }}
    />
    <InputRowPrice price={getAdjustedPrice(CUSTOM_WORKLOAD_DEPLOYMENT_COST, calculatorStore)} perCluster={true}/>
  </>
  );
};

export default CustomWorkloadCountInput;
