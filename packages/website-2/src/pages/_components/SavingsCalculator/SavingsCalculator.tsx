import type { Component } from "solid-js";

import {
  type Background,
  BackgroundContext,
} from "@/components/context/background.ts";
import CICDMinutesInput from "@/pages/_components/SavingsCalculator/CICDMinutesInput.tsx";
import DeveloperCountInput from "@/pages/_components/SavingsCalculator/DeveloperCountInput.tsx";
import EgressTrafficInput from "@/pages/_components/SavingsCalculator/EgressTrafficInput.tsx";
import EmployeeCountInput from "@/pages/_components/SavingsCalculator/EmployeeCountInput.tsx";
import SupportCostsIncludedInput from "@/pages/_components/SavingsCalculator/IncludeLaborCostsInput.tsx";
import InterAZTrafficInput from "@/pages/_components/SavingsCalculator/InterAZTrafficInput.tsx";
import KVDBCores from "@/pages/_components/SavingsCalculator/KVDBCores.tsx";
import KVDBMemoryInput from "@/pages/_components/SavingsCalculator/KVDBMemoryInput.tsx";
import KVDBStorageInput from "@/pages/_components/SavingsCalculator/KVDBStorageInput.tsx";
import LaborCostInput from "@/pages/_components/SavingsCalculator/LaborCostInput.tsx";
import LogsInput from "@/pages/_components/SavingsCalculator/LogsInput.tsx";
import MetricsInput from "@/pages/_components/SavingsCalculator/MetricsInput.tsx";
import ProductivityBoostInput from "@/pages/_components/SavingsCalculator/ProductivityBoostInput.tsx";
import RelDBCoresInput from "@/pages/_components/SavingsCalculator/RelDBCoresInput.tsx";
import RelDBMemoryInput from "@/pages/_components/SavingsCalculator/RelDBMemoryInput.tsx";
import RelDBStorageInput from "@/pages/_components/SavingsCalculator/RelDBStorageInput.tsx";
import SpansInput from "@/pages/_components/SavingsCalculator/SpansInput.tsx";
import UtilizationInput from "@/pages/_components/SavingsCalculator/UtilizationInput.tsx";
import VPCCountInput from "@/pages/_components/SavingsCalculator/VPCCountInput.tsx";
import WorkloadCoresInput from "@/pages/_components/SavingsCalculator/WorkloadCoresInput.tsx";
import WorkloadMemoryInput from "@/pages/_components/SavingsCalculator/WorkloadMemoryInput.tsx";

import SavingsSummary from "./SavingsSummary.tsx";
import InputRow from "../inputs/InputRow.tsx";

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
