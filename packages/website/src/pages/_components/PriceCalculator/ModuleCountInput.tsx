import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import ModuleCountDescription from "@/pages/_components/PriceCalculator/ModuleCountDescription.tsx";
import { getAdjustedPrice } from "@/pages/_components/PriceCalculator/calculatePlanPrice.ts";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.tsx";
import InputRowPrice from "@/pages/_components/inputs/InputRowPrice.tsx";
import { MODULE_DEPLOYMENT_COST } from "@/pages/_components/priceConstants.ts";

const ModuleCountInput: Component = () => {
  return (
    <>
      <IntegerInput
        id={"module-count"}
        label={"# of Standard Modules"}
        description={ModuleCountDescription}
        value={calculatorStore.moduleCount}
        max={1000}
        onChange={(newVal) => {
          setCalculatorStore("moduleCount", newVal);
        }}
      />
      <InputRowPrice
        price={getAdjustedPrice(MODULE_DEPLOYMENT_COST, calculatorStore)}
        perCluster={true}
        clusterCount={calculatorStore.clusterCount}
      />
    </>
  );
};

export default ModuleCountInput;
