import {
  ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
  CLUSTER_COST,
  PRIORITY_SUPPORT_MULTIPLIER,
  STARTUP_DISCOUNT_MULTIPLIER,
  SUPPORT_HOURS_OPTIONS,
  CUSTOM_WORKLOAD_DEPLOYMENT_COST,
} from "../priceConstants.ts";

export type PlanPriceLineItem = {
  name: string;
  subTotal: number;
  unitPrice: number;
  quantity: number;
  quantityDescription?: string;
};

export interface PlanPriceInputs {
  clusterCount: number;
  workloadCount: number;
  prioritySupportEnabled: boolean;
  supportHours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"];
  annualSpendCommitmentEnabled: boolean;
  startupDiscountEnabled: boolean;
}

export const getSupportHoursOption =  (hours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"]) => {
return SUPPORT_HOURS_OPTIONS.find(
  ({ id }) => id === hours,
);
}

export const getSupportHoursMultiplier = (hours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"]) => {
  return getSupportHoursOption(hours)?.multiplier || 0;
}

export const getAdjustedPrice = (basePrice: number, input: PlanPriceInputs) => {
  let total = basePrice;
  if(input.prioritySupportEnabled){
    total *= 1 + PRIORITY_SUPPORT_MULTIPLIER
  }
  total *= 1 + getSupportHoursMultiplier(input.supportHours)
  if(input.startupDiscountEnabled){
    total *= 1 + STARTUP_DISCOUNT_MULTIPLIER
  }
  if(input.annualSpendCommitmentEnabled){
    total *= 1 + ANNUAL_SPEND_DISCOUNT_MULTIPLIER
  }
  return total
}

export const calculatePlanPrice: (inputs: PlanPriceInputs) => {
  total: number;
  lineItems: PlanPriceLineItem[];
} = (inputs) => {
  ///////////////////////////////////////////////////
  // Base Items
  ///////////////////////////////////////////////////
  const lineItems: Array<PlanPriceLineItem> = [
    {
      name: "Panfactum Kubernetes Clusters",
      unitPrice: CLUSTER_COST,
      quantity: inputs.clusterCount,
      subTotal: CLUSTER_COST * inputs.clusterCount,
    },
    {
      name: "Workload Deployments",
      unitPrice: CUSTOM_WORKLOAD_DEPLOYMENT_COST,
      quantity: inputs.clusterCount * inputs.workloadCount,
      subTotal:
        CUSTOM_WORKLOAD_DEPLOYMENT_COST * inputs.clusterCount * inputs.workloadCount,
    },
  ];

  const baselineSubtotal = calculateRunningTotal(lineItems);

  ///////////////////////////////////////////////////
  // Addons
  ///////////////////////////////////////////////////
  if (inputs.prioritySupportEnabled) {
    lineItems.push({
      name: "Addon: Priority Support",
      unitPrice: PRIORITY_SUPPORT_MULTIPLIER,
      quantity: baselineSubtotal,
      subTotal: baselineSubtotal * PRIORITY_SUPPORT_MULTIPLIER,
      quantityDescription:
        "Addons are a multiplier of the base price before any additional addons or discounts.",
    });
  }

  const supportHoursMultiplier = getSupportHoursMultiplier(inputs.supportHours)
  if (supportHoursMultiplier > 0) {
    lineItems.push({
      name: `Addon: Support Hours - ${getSupportHoursOption(inputs.supportHours)?.name}`,
      unitPrice: supportHoursMultiplier,
      quantity: baselineSubtotal,
      subTotal: baselineSubtotal * supportHoursMultiplier,
      quantityDescription:
        "Addons are a multiplier of the base price before any additional addons or discounts.",
    });
  }

  const subtotalWithAddons = calculateRunningTotal(lineItems);

  ///////////////////////////////////////////////////
  // Discounts
  ///////////////////////////////////////////////////
  if (inputs.startupDiscountEnabled) {
    lineItems.push({
      name: `Discount: Startup`,
      unitPrice: STARTUP_DISCOUNT_MULTIPLIER,
      quantity: subtotalWithAddons,
      subTotal: subtotalWithAddons * STARTUP_DISCOUNT_MULTIPLIER,
      quantityDescription:
        "In order to maximize your savings, discounts are applied AFTER support addons.",
    });
  }

  if (inputs.annualSpendCommitmentEnabled) {
    lineItems.push({
      name: `Discount: Annual Spend`,
      unitPrice: ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
      quantity: subtotalWithAddons,
      subTotal: subtotalWithAddons * ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
      quantityDescription:
        "In order to maximize your savings, discounts are applied AFTER support addons.",
    });
  }

  return {
    lineItems,
    total: calculateRunningTotal(lineItems),
  };
};

function calculateRunningTotal(lineItems: Array<PlanPriceLineItem>) {
  return lineItems.reduce((acc, { subTotal }) => {
    return acc + subTotal;
  }, 0);
}
