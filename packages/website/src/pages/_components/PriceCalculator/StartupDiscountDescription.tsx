import { NUMBER_FORMAT } from "@/lib/utils.ts";
import CalculatorDescriptionContainer from "@/pages/_components/details/CalculatorDescriptionContainer.tsx";
import { STARTUP_DISCOUNT_MULTIPLIER } from "@/pages/_components/priceConstants.ts";

const StartupDiscountDescription = () => (
  <CalculatorDescriptionContainer>
    <p>
      For organizations with less than $5,000 / month in AWS spend, we offer a
      flat {NUMBER_FORMAT.format(-STARTUP_DISCOUNT_MULTIPLIER * 100)}% discount
      on our support plan pricing. This discount expires when your organization
      exceeds the $5,000 / month threshold.
    </p>
  </CalculatorDescriptionContainer>
);

export default StartupDiscountDescription;
