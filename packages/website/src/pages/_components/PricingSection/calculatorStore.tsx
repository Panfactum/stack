import { toaster } from "@kobalte/core/toast";
import { createEffect, createRoot, createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { isServer } from "solid-js/web";

import Toast from "@/components/ui/Toast.tsx";
import { SUPPORT_HOURS_OPTIONS } from "@/pages/_components/PricingSection/priceConstants";

/****************************************************
 Store Configuration
 ***************************************************/

export const PlanOptions = [
  { label: "<$2.5K", value: 1 },
  { label: "$2.5-5K", value: 2 },
  { label: "$5-50K+", value: 3 },
  { label: "$50K+", value: 4 },
] as const;

export interface CalculatorStorePlanPriceComponents {
  annualSpendCommitmentEnabled: boolean;
  clusterCount: number;
  workloadCount: number;
  dbCount: number;
  moduleCount: number;
  prioritySupportEnabled: boolean;
  supportHours: (typeof SUPPORT_HOURS_OPTIONS)[number]["id"];
}

export interface CalculatorStoreSavingsComponents {
  plan: (typeof PlanOptions)[number]["value"];
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
  supportPlanPrice: number;
  clusterCount: number;
  workloadCount: number;
  dbCount: number;
  moduleCount: number;
  savingsCalculatorEdited: boolean;
  clusterOptionsEdited: boolean;
}

export interface CalculatorStore
  extends CalculatorStorePlanPriceComponents,
    CalculatorStoreSavingsComponents {}

export const [calculatorStore, setCalculatorStore] =
  createStore<CalculatorStore>({
    plan: 1,
    clusterCount: 3,
    workloadCount: 2,
    dbCount: 1,
    moduleCount: 1,
    annualSpendCommitmentEnabled: true,
    prioritySupportEnabled: false,
    supportHours: "basic",
    workloadCores: 20,
    workloadMemory: 40,
    relDBCores: 6,
    relDBMemory: 18,
    relDBStorage: 100,
    kvDBCores: 6,
    kvDBMemory: 18,
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
    utilization: 25,
    supportPlanPrice: 0,
    savingsCalculatorEdited: false,
    clusterOptionsEdited: false,
  });

/****************************************************
 Store Sharing - Copy share link to clipboard
 ***************************************************/

export const shareCalculatorValues = (calcId: "pricing") => {
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
      case "plan":
        if (value) {
          try {
            const maybePlan = parseInt(value);
            if (
              maybePlan == 1 ||
              maybePlan == 2 ||
              maybePlan == 3 ||
              maybePlan == 4
            ) {
              rehydratedSettings[key] = maybePlan;
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                `Calculator Store: Invalid plan value. Given ${value}.`,
              );
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
              `Calculator Store: Could not parse value for ${key}. Given ${value}.`,
            );
          }
        }
        break;
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
      case "savingsCalculatorEdited":
      case "clusterOptionsEdited":
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

  createEffect(() => {
    if (!calculatorStore.clusterOptionsEdited) {
      if (calculatorStore.plan === 1) {
        setCalculatorStore("clusterCount", 1);
        setCalculatorStore("dbCount", 0);
        setCalculatorStore("moduleCount", 1);
        setCalculatorStore("workloadCount", 1);
      } else if (calculatorStore.plan === 2) {
        setCalculatorStore("clusterCount", 2);
        setCalculatorStore("dbCount", 0);
        setCalculatorStore("moduleCount", 1);
        setCalculatorStore("workloadCount", 1);
      } else if (calculatorStore.plan === 3) {
        setCalculatorStore("clusterCount", 2);
        setCalculatorStore("dbCount", 1);
        setCalculatorStore("moduleCount", 2);
        setCalculatorStore("workloadCount", 2);
      }
    }

    if (!calculatorStore.savingsCalculatorEdited) {
      // Calculate the actual number of databases that we're using
      // between relational dbs and kv dbs (update when other DBs are added)
      const adjustedRelDBCount =
        calculatorStore.clusterCount *
        Math.floor(
          (calculatorStore.dbCount + calculatorStore.moduleCount * 1.5) / 2 +
            0.5,
        );
      const adjustedKVDBCount =
        calculatorStore.clusterCount *
        Math.floor(
          (calculatorStore.dbCount + calculatorStore.moduleCount * 1.5) / 2,
        );
      setCalculatorStore("relDBStorage", 100 * adjustedRelDBCount);
      setCalculatorStore("relDBCores", Math.floor(0.5 * adjustedRelDBCount));
      setCalculatorStore("relDBMemory", Math.floor(1.5 * adjustedRelDBCount));
      setCalculatorStore("kvDBStorage", 0 * adjustedKVDBCount);
      setCalculatorStore("kvDBCores", Math.floor(0.5 * adjustedKVDBCount));
      setCalculatorStore("kvDBMemory", Math.floor(2 * adjustedKVDBCount));

      // Calculate the actual number of workloads that we're using
      // between custom workloads and prebuilt modules
      const adjustedWorkloadCount =
        calculatorStore.clusterCount *
        (calculatorStore.workloadCount + calculatorStore.moduleCount);
      setCalculatorStore(
        "workloadCores",
        Math.floor(0.5 * adjustedWorkloadCount),
      );
      setCalculatorStore(
        "workloadMemory",
        Math.floor(1.5 * adjustedWorkloadCount),
      );

      setCalculatorStore(
        "logs",
        5 * (adjustedWorkloadCount + adjustedRelDBCount + adjustedKVDBCount),
      );
      setCalculatorStore(
        "spans",
        5 * (adjustedWorkloadCount + adjustedRelDBCount + adjustedKVDBCount),
      );
      setCalculatorStore(
        "metrics",
        Math.floor(
          0.1 *
            (adjustedWorkloadCount + adjustedRelDBCount + adjustedKVDBCount) +
            calculatorStore.clusterCount,
        ),
      );
      setCalculatorStore(
        "cicdMinutes",
        24 *
          30 *
          60 *
          calculatorStore.clusterCount *
          calculatorStore.workloadCount,
      );
      setCalculatorStore("vpcCount", calculatorStore.clusterCount);
      setCalculatorStore(
        "egressTraffic",
        100 * calculatorStore.clusterCount * calculatorStore.workloadCount,
      );
      setCalculatorStore(
        "interAZTraffic",
        100 * (adjustedWorkloadCount + adjustedRelDBCount + adjustedKVDBCount),
      );
      setCalculatorStore("utilization", 25);
    }
  });
});
