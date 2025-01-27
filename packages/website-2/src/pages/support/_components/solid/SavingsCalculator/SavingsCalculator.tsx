import type { Component } from "solid-js";

import {
  type Background,
  BackgroundContext,
} from "@/components/solid/context/background.ts";
import CICDMinutesInput from "@/pages/support/_components/solid/SavingsCalculator/CICDMinutesInput.tsx";
import DeveloperCountInput from "@/pages/support/_components/solid/SavingsCalculator/DeveloperCountInput.tsx";
import EgressTrafficInput from "@/pages/support/_components/solid/SavingsCalculator/EgressTrafficInput.tsx";
import EmployeeCountInput from "@/pages/support/_components/solid/SavingsCalculator/EmployeeCountInput.tsx";
import SupportCostsIncludedInput from "@/pages/support/_components/solid/SavingsCalculator/IncludeLaborCostsInput.tsx";
import InterAZTrafficInput from "@/pages/support/_components/solid/SavingsCalculator/InterAZTrafficInput.tsx";
import KVDBCores from "@/pages/support/_components/solid/SavingsCalculator/KVDBCores.tsx";
import KVDBMemoryInput from "@/pages/support/_components/solid/SavingsCalculator/KVDBMemoryInput.tsx";
import KVDBStorageInput from "@/pages/support/_components/solid/SavingsCalculator/KVDBStorageInput.tsx";
import LaborCostInput from "@/pages/support/_components/solid/SavingsCalculator/LaborCostInput.tsx";
import LogsInput from "@/pages/support/_components/solid/SavingsCalculator/LogsInput.tsx";
import MetricsInput from "@/pages/support/_components/solid/SavingsCalculator/MetricsInput.tsx";
import ProductivityBoostInput from "@/pages/support/_components/solid/SavingsCalculator/ProductivityBoostInput.tsx";
import RelDBCoresInput from "@/pages/support/_components/solid/SavingsCalculator/RelDBCoresInput.tsx";
import RelDBMemoryInput from "@/pages/support/_components/solid/SavingsCalculator/RelDBMemoryInput.tsx";
import RelDBStorageInput from "@/pages/support/_components/solid/SavingsCalculator/RelDBStorageInput.tsx";
import SpansInput from "@/pages/support/_components/solid/SavingsCalculator/SpansInput.tsx";
import UtilizationInput from "@/pages/support/_components/solid/SavingsCalculator/UtilizationInput.tsx";
import VPCCountInput from "@/pages/support/_components/solid/SavingsCalculator/VPCCountInput.tsx";
import WorkloadCoresInput from "@/pages/support/_components/solid/SavingsCalculator/WorkloadCoresInput.tsx";
import WorkloadMemoryInput from "@/pages/support/_components/solid/SavingsCalculator/WorkloadMemoryInput.tsx";

import SavingsSummary from "./SavingsSummary.tsx";
import InputRow from "../inputs/InputRow";

interface SavingsCalculatorProps {
  background: Background;
}

const SavingsCalculator: Component<SavingsCalculatorProps> = (props) => {
  return (
    // eslint-disable-next-line solid/reactivity
    <BackgroundContext.Provider value={props.background}>
      <div class="w-full">
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
        <InputRow title={"Modifiers"}>
          <ProductivityBoostInput />
          <SupportCostsIncludedInput />
        </InputRow>
      </div>
      <SavingsSummary />
    </BackgroundContext.Provider>
  );
};

export default SavingsCalculator;
