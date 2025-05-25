import { Button } from "@kobalte/core/button";
import { type Component } from "solid-js";

import Tooltip from "@/components/ui/Tooltip";
import {
  setCalculatorStore,
  calculatorStore,
} from "@/pages/_archived/plus/pricing/_components/PricingSection/calculatorStore";

import CICDMinutesInput from "./fields/CICDMinutesInput";
import DeveloperCountInput from "./fields/DeveloperCountInput";
import EgressTrafficInput from "./fields/EgressTrafficInput";
import EmployeeCountInput from "./fields/EmployeeCountInput";
import InterAZTrafficInput from "./fields/InterAZTrafficInput";
import KVDBCores from "./fields/KVDBCores";
import KVDBMemoryInput from "./fields/KVDBMemoryInput";
import KVDBStorageInput from "./fields/KVDBStorageInput";
import LaborCostInput from "./fields/LaborCostInput";
import LogsInput from "./fields/LogsInput";
import MetricsInput from "./fields/MetricsInput";
import RelDBCoresInput from "./fields/RelDBCoresInput";
import RelDBMemoryInput from "./fields/RelDBMemoryInput";
import RelDBStorageInput from "./fields/RelDBStorageInput";
import SpansInput from "./fields/SpansInput";
import UtilizationInput from "./fields/UtilizationInput";
import VPCCountInput from "./fields/VPCCountInput";
import WorkloadCoresInput from "./fields/WorkloadCoresInput";
import WorkloadMemoryInput from "./fields/WorkloadMemoryInput";
import InputRow from "./inputs/InputRow";

const SavingsCalculator: Component = () => {
  return (
    <>
      <div class="mb-4 ml-8 flex">
        <Tooltip
          content="Provides default values based on the current support plan settings."
          placement="top"
        >
          <Button
            class="text-display-md rounded bg-brand-500 px-4 py-2 text-white shadow-md hover:bg-brand-600 disabled:bg-gray-light-mode-400 disabled:text-gray-light-mode-200"
            disabled={!calculatorStore.savingsCalculatorEdited}
            onClick={() => {
              setCalculatorStore("savingsCalculatorEdited", false);
            }}
          >
            Reset Defaults
          </Button>
        </Tooltip>
      </div>
      <InputRow title={"Organization"}>
        <EmployeeCountInput />
        <DeveloperCountInput />
        <LaborCostInput />
      </InputRow>
      <InputRow title={"Network"}>
        <VPCCountInput />
        <EgressTrafficInput />
        <InterAZTrafficInput />
      </InputRow>
      <InputRow title={"Resource Utilization %"}>
        <UtilizationInput />
      </InputRow>
      <InputRow title={"Application Servers"}>
        <WorkloadCoresInput />
        <WorkloadMemoryInput />
      </InputRow>
      <InputRow title={"Relational Databases"}>
        <RelDBCoresInput />
        <RelDBMemoryInput />
        <RelDBStorageInput />
      </InputRow>
      <InputRow title={"Key-Value Databases"}>
        <KVDBCores />
        <KVDBMemoryInput />
        <KVDBStorageInput />
      </InputRow>
      <InputRow title={"Observability"}>
        <LogsInput />
        <MetricsInput />
        <SpansInput />
      </InputRow>
      <InputRow title={"CI / CD"}>
        <CICDMinutesInput />
      </InputRow>
    </>
  );
};

export default SavingsCalculator;
