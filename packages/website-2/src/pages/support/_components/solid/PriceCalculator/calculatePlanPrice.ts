import {
  ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
  CLOUD_COST,
  CLUSTER_COST,
  PRIORITY_SUPPORT_MULTIPLIER,
  STARTUP_DISCOUNT_MULTIPLIER,
  SUPPORT_HOURS_OPTIONS,
  WORKLOAD_DEPLOYMENT_COST,
} from "../../priceConstants";

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

export const calculatePlanPrice: (inputs: PlanPriceInputs) => {
  total: number;
  lineItems: PlanPriceLineItem[];
} = (inputs) => {
  ///////////////////////////////////////////////////
  // Base Items
  ///////////////////////////////////////////////////
  const lineItems: Array<PlanPriceLineItem> = [
    {
      name: "Cloud Foundations",
      unitPrice: CLOUD_COST,
      quantity: 1,
      subTotal: CLOUD_COST,
    },
    {
      name: "Panfactum Kubernetes Clusters",
      unitPrice: CLUSTER_COST,
      quantity: inputs.clusterCount,
      subTotal: CLUSTER_COST * inputs.clusterCount,
    },
    {
      name: "Workload Deployments",
      unitPrice: WORKLOAD_DEPLOYMENT_COST,
      quantity: inputs.clusterCount * inputs.workloadCount,
      subTotal:
        WORKLOAD_DEPLOYMENT_COST * inputs.clusterCount * inputs.workloadCount,
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

  const supportHoursOption = SUPPORT_HOURS_OPTIONS.find(
    ({ id }) => id === inputs.supportHours,
  );
  const supportHoursMultiplier = supportHoursOption?.multiplier || 0;
  if (supportHoursMultiplier > 0) {
    lineItems.push({
      name: `Addon: Support Hours - ${supportHoursOption?.name}`,
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
