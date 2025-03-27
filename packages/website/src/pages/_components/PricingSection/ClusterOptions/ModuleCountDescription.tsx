import CalculatorDescriptionContainer from "@/pages/_components/PricingSection/SavingsEstimator/details/CalculatorDescriptionContainer";

const ModuleCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      A prebuilt module is any workload for which we already have an
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
