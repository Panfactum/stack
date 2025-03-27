import {
  ANNUAL_SPEND_DISCOUNT_MULTIPLIER,
  CLUSTER_COST,
  PRIORITY_SUPPORT_MULTIPLIER,
  STARTUP_DISCOUNT_MULTIPLIER,
  SUPPORT_HOURS_OPTIONS,
  CUSTOM_WORKLOAD_DEPLOYMENT_COST, MODULE_DEPLOYMENT_COST, DATABASE_DEPLOYMENT_COST,
  FLAT_RATE_PRICE,
} from "./priceConstants.ts";

export type PlanPriceLineItem = {
  name: string;
  subTotal: number;
  unitPrice: number;
  quantity: number;
  quantityDescription?: string;
};

export interface PlanPriceInputs {
  plan: number;
  clusterCount: number;
  workloadCount: number;
  moduleCount: number;
  dbCount: number;
  prioritySupportEnabled: boolean;
  supportHours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"];
  annualSpendCommitmentEnabled: boolean;
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
    total += basePrice * PRIORITY_SUPPORT_MULTIPLIER
  }
  total += basePrice * getSupportHoursMultiplier(input.supportHours)

  const subtotal = total;

  if(input.plan === 2){
    total += subtotal * STARTUP_DISCOUNT_MULTIPLIER
  }
  if(input.annualSpendCommitmentEnabled){
    total += subtotal * ANNUAL_SPEND_DISCOUNT_MULTIPLIER
  }
  return total
}

export const calculatePlanPrice: (inputs: PlanPriceInputs) => {
  total: number;
  perClusterPrice: number;
  perClusterDiscounts: number;
  daysToLaunch: number;
} = (inputs) => {

  if(inputs.plan === 1){
    const priceWithAddons = FLAT_RATE_PRICE + (inputs.prioritySupportEnabled ? (FLAT_RATE_PRICE * PRIORITY_SUPPORT_MULTIPLIER) : 0) + FLAT_RATE_PRICE * getSupportHoursMultiplier(inputs.supportHours)
    const price = priceWithAddons + (inputs.annualSpendCommitmentEnabled ? (priceWithAddons * ANNUAL_SPEND_DISCOUNT_MULTIPLIER) : 0)
    return {
      perClusterDiscounts: 0,
      perClusterPrice: price,
      total: price,
      daysToLaunch: 3, // Normally, if they are in this tier, it is mostly a greenfield project and 3 is a good avg
    }
  }

  ///////////////////////////////////////////////////
  // Per Cluster Price
  ///////////////////////////////////////////////////
  const baseClusterPrice = CLUSTER_COST + MODULE_DEPLOYMENT_COST * inputs.moduleCount + DATABASE_DEPLOYMENT_COST * inputs.dbCount + CUSTOM_WORKLOAD_DEPLOYMENT_COST * inputs.workloadCount

  ///////////////////////////////////////////////////
  // Addons
  ///////////////////////////////////////////////////
  const clusterPriceWithAddons = baseClusterPrice + (inputs.prioritySupportEnabled ? (baseClusterPrice * PRIORITY_SUPPORT_MULTIPLIER) : 0) + baseClusterPrice * getSupportHoursMultiplier(inputs.supportHours)

  ///////////////////////////////////////////////////
  // Discounts
  ///////////////////////////////////////////////////
  const perClusterDiscounts = (inputs.plan === 2 ? ( clusterPriceWithAddons * STARTUP_DISCOUNT_MULTIPLIER) : 0) +
  (inputs.annualSpendCommitmentEnabled ? (clusterPriceWithAddons * ANNUAL_SPEND_DISCOUNT_MULTIPLIER) : 0)
  const perClusterPrice = clusterPriceWithAddons + perClusterDiscounts

  ///////////////////////////////////////////////////
  // Time to Launch
  ///////////////////////////////////////////////////
  const baseTime = inputs.plan === 2 ? 1 : 3 // Larger clients have higher inbuilt complexity just to get a handle on their footprint
  const clusterSetup = 0.5 * inputs.clusterCount
  const workloadSetup = (inputs.plan === 2 ? 1 : 2) * inputs.workloadCount + 0.25 * inputs.workloadCount * inputs.clusterCount // Larger clients have more complex custom workloads
  const dbSetup = 0.5 * inputs.dbCount + (inputs.plan === 2 ? 0.25 : 1) * inputs.dbCount * inputs.clusterCount // Larger clients need to have a zero-dowtime migration
  const moduleSetup = 0.25 * inputs.moduleCount + 0.25 *inputs.moduleCount * inputs.clusterCount
  const daysToLaunch = Math.floor(baseTime +clusterSetup + workloadSetup + dbSetup + moduleSetup)

  return {
    perClusterDiscounts,
    perClusterPrice,
    total: perClusterPrice * inputs.clusterCount,
    daysToLaunch
  };
};