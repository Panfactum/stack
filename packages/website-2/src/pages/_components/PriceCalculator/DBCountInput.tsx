import type { Component } from "solid-js";

import { IntegerInput } from "@/components/inputs/IntegerInput.tsx";
import DBCountDescription from "@/pages/_components/PriceCalculator/DBCountDescription.tsx";
import {getAdjustedPrice} from "@/pages/_components/PriceCalculator/calculatePlanPrice.ts";
import {
  calculatorStore,
  setCalculatorStore,
} from "@/pages/_components/calculatorStore.ts";
import InputRowPrice from "@/pages/_components/inputs/InputRowPrice.tsx";
import {DATABASE_DEPLOYMENT_COST} from "@/pages/_components/priceConstants.ts";

const DBCountInput: Component = () => {
  return (
    <>
    <IntegerInput
      id={"db-count"}
      label={"# of Databases"}
      description={DBCountDescription}
      value={calculatorStore.dbCount}
      max={1000}
      onChange={(newVal) => {
        setCalculatorStore("dbCount", newVal);
      }}
    />
  <InputRowPrice price={getAdjustedPrice(DATABASE_DEPLOYMENT_COST, calculatorStore)} perCluster={true}/>
</>
  );
};

export default DBCountInput;
