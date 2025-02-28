import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import { MODULE_DEPLOYMENT_COST } from "@/pages/_components/priceConstants.ts";

const ModuleCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      <span class="font-semibold">Base Cost:</span>{" "}
      {CURRENCY_FORMAT.format(MODULE_DEPLOYMENT_COST)} / cluster (before any
      support modifiers or discounts)
    </p>
    <p>
      A standard module is any workload for which we already have an
      off-the-shelf infrastructure-as-code module. We provide dozens of modules
      for popular open-source projects.
    </p>
    <p>
      Our work for these modules involves tuning them for your particular
      use-case, keeping them updated, and providing immediate front-line support
      should something go wrong.
    </p>
    <p>
      Because these modules involve minimal custom code, we are able to pass
      significant savings onto you (versus custom workloads). Additionally, if
      the module bundles a database (i.e., the workload requires a database to
      run), that database is provided at no additional charge as we have already
      completed the database tuning in advance.
    </p>
  </CalculatorDescriptionContainer>
);

export default ModuleCountDescription;
