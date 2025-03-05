import { NUMBER_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import { ANNUAL_SPEND_DISCOUNT_MULTIPLIER } from "@/pages/_components/priceConstants.ts";

const AnnualSpendCommitmentDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      By default, every support contract is usage-based. In other words, every
      month you will only by charged for the infrastructure that you currently
      have.
    </p>
    <p>
      However, if you commit in advance for the following 12 months, we can
      offer a flat{" "}
      {NUMBER_FORMAT.format(-ANNUAL_SPEND_DISCOUNT_MULTIPLIER * 100)}% discount
      on the committed spend.
    </p>
    <p>
      The commitment is decided at contract signing but payments are still made
      monthly.
    </p>
    <p>
      This can be adjusted upward at any point to ensure that new workloads can
      receive the discounted rate. Every year at contract renewal you will have
      the opportunity to rightsize the committed spend to your current
      footprint.
    </p>
  </CalculatorDescriptionContainer>
);

export default AnnualSpendCommitmentDescription;
