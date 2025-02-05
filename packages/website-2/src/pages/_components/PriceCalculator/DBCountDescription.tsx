import { CURRENCY_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import { DATABASE_DEPLOYMENT_COST,
} from "@/pages/_components/priceConstants.ts";

const DBCountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      <span class="font-semibold">Base Cost:</span> {CURRENCY_FORMAT.format(DATABASE_DEPLOYMENT_COST)} / cluster (before
      any support modifiers or discounts)
    </p>
    <p>
      A database module is any database system for which we already have an off-the-shelf infrastructure-as-code module that we
      can use to deploy it. We provide many modules for popular open-source databases.
    </p>
    <p>
      Our work for these modules involves tuning them for your particular use-case, keeping them updated, and providing
      immediate front-line support should something go wrong.
    </p>
    <p>
      Because these modules typically involve extensive, complex, and repeated tuning, we charge more than our
      other standard modules to ensure that we can cover our costs.
    </p>
  </CalculatorDescriptionContainer>
);

export default DBCountDescription;
