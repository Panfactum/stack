import { NUMBER_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/support/_components/details/CalculatorDescriptionContainer.tsx";
import {
  ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
} from "@/pages/support/_components/priceConstants.ts";

const AnnualSpendCommitmentDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      By default, every support contract is usage-based. In other words, every
      month you will only by charged for the infrastructure that you currently
      have.
    </p>
    <p>
      However, if you pay in advance for the following 12 months, we can offer a
      flat {NUMBER_FORMAT.format(-ANNUAL_SPEND_DISCOUNT_MULTIPLIER * 100)}%
      discount on the committed spend.
    </p>
    <p>
      For the purposes of this calculator, this toggle includes <em>all</em>{" "}
      spend. However, we can tailor your support contract to any desired level
      of commitment.
    </p>
  </CalculatorDescriptionContainer>
);

export default AnnualSpendCommitmentDescription;
