import { toaster } from "@kobalte/core/toast";
import { createEffect, createRoot, createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { isServer } from "solid-js/web";

import Toast from "@/components/ui/Toast.tsx";
import { SUPPORT_HOURS_OPTIONS } from "@/pages/_components/priceConstants.ts";

/****************************************************
 Store Configuration
 ***************************************************/

export interface CalculatorStorePlanPriceComponents {
  annualSpendCommitmentEnabled: boolean;
  clusterCount: number;
  workloadCount: number;
  dbCount: number;
  moduleCount: number;
  prioritySupportEnabled: boolean;
  startupDiscountEnabled: boolean;
  supportHours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"];
}

export interface CalculatorStoreSavingsComponents {
  workloadCores: number;
  workloadMemory: number;
  relDBCores: number;
  relDBMemory: number;
  relDBStorage: number;
  kvDBCores: number;
  kvDBMemory: number;
  kvDBStorage: number;
  logs: number;
  spans: number;
  metrics: number;
  cicdMinutes: number;
  egressTraffic: number;
  interAZTraffic: number;
  vpcCount: number;
  employeeCount: number;
  developerCount: number;
  laborHourlyCost: number;
  utilization: number;
  productivityBoostEnabled: boolean;
  supportCostsIncluded: boolean;
  supportPlanPrice: number;
  clusterCount: number;
  workloadCount: number;
  dbCount: number;
  moduleCount: number;
}

export interface CalculatorStore
  extends CalculatorStorePlanPriceComponents,
    CalculatorStoreSavingsComponents {}

export const [calculatorStore, setCalculatorStore] =
  createStore<CalculatorStore>({
    clusterCount: 3,
    workloadCount: 2,
    dbCount: 1,
    moduleCount: 1,
    annualSpendCommitmentEnabled: true,
    prioritySupportEnabled: false,
    startupDiscountEnabled: true,
    supportHours: "basic",
    workloadCores: 3,
    workloadMemory: 6,
    relDBCores: 1,
    relDBMemory: 2,
    relDBStorage: 100,
    kvDBCores: 2,
    kvDBMemory: 6,
    kvDBStorage: 0,
    logs: 100,
    spans: 10,
    metrics: 10,
    cicdMinutes: 60 * 24 * 30,
    egressTraffic: 100,
    interAZTraffic: 1000,
    vpcCount: 1,
    employeeCount: 10,
    developerCount: 5,
    laborHourlyCost: 100,
    utilization: 30,
    productivityBoostEnabled: false,
    supportCostsIncluded: false,
    supportPlanPrice: 0,
  });

/****************************************************
 Store Sharing - Copy share link to clipboard
 ***************************************************/

export const shareCalculatorValues = (
  calcId: "plan-calculator" | "savings-calculator",
) => {
  const stringifiedStore = Object.fromEntries(
    Object.entries(unwrap(calculatorStore)).map(([key, val]) => [
      key,
      `${val}`,
    ]),
  );

  stringifiedStore["id"] = calcId;
  const params = new URLSearchParams(stringifiedStore);

  // Combine the current page URL with the href
  const fullUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  // Copy the full URL to the clipboard
  void navigator.clipboard.writeText(fullUrl);

  // Show a toast
  const toastID = toaster.show((props) => (
    <Toast id={props.toastId} title={"Link copied to clipboard"} />
  ));

  setTimeout(() => toaster.dismiss(toastID), 2000);
};

/****************************************************
 Store Rehydration

 This enables the user's calculator settings to be saved and shared
 ***************************************************/

const PRICE_CALCULATOR_LOCAL_STORAGE_KEY = "panfactum-price-calculator";
const [seeded, setSeeded] = createSignal(false);
export const seedCalculator = () => {
  let rehydratedSettings: Partial<CalculatorStore> = {};

  // Step 1: Seed from local storage
  const localStorageSettings = window.localStorage.getItem(
    PRICE_CALCULATOR_LOCAL_STORAGE_KEY,
  );
  if (localStorageSettings) {
    rehydratedSettings = JSON.parse(
      localStorageSettings,
    ) as Partial<CalculatorStore>;
  }

  // Step 2: Override anything in local storage with the query string values
  // as they should take priority
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.forEach((value, key) => {
    switch (key) {
      case "workloadCores":
      case "workloadMemory":
      case "relDBCores":
      case "relDBMemory":
      case "relDBStorage":
      case "kvDBCores":
      case "kvDBMemory":
      case "kvDBStorage":
      case "logs":
      case "spans":
      case "metrics":
      case "cicdMinutes":
      case "egressTraffic":
      case "interAZTraffic":
      case "vpcCount":
      case "employeeCount":
      case "developerCount":
      case "laborHourlyCost":
      case "utilization":
      case "workloadCount":
      case "clusterCount":
        if (value) {
          try {
            rehydratedSettings[key] = parseInt(value);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
              `Calculator Store: Could not parse value for ${key}. Given ${value}.`,
            );
          }
        }
        break;

      case "annualSpendCommitmentEnabled":
      case "prioritySupportEnabled":
      case "startupDiscountEnabled":
      case "supportCostsIncluded":
      case "productivityBoostEnabled":
        if (value === "true") {
          rehydratedSettings[key] = true;
        } else if (value === "false") {
          rehydratedSettings[key] = false;
        }
        break;

      case "supportHours":
        if (value === "basic" || value === "enhanced" || value === "24-7") {
          rehydratedSettings[key] = value;
        }
        break;

      case "id":
        if (!isServer) {
          // This is necessary b/c hash scrolling doesn't work when combined with query params
          window.document.getElementById(value)?.scrollIntoView();
        }
        break;
    }
  });
  setCalculatorStore(rehydratedSettings);
  setSeeded(true);
};

// When the calculator values update, dave them in local storage
createRoot(() => {
  createEffect(() => {
    // Ensure that we don't save the values before they have been rehydrated
    if (seeded()) {
      window.localStorage.setItem(
        PRICE_CALCULATOR_LOCAL_STORAGE_KEY,
        JSON.stringify(calculatorStore),
      );
    }
  });
});
