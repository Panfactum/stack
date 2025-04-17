import { Button } from "@kobalte/core/button";
import { Collapsible } from "@kobalte/core/collapsible";
import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";

import Modal from "@/components/ui/Modal";
import { CURRENCY_FORMAT, NUMBER_FORMAT } from "@/lib/utils";

import ClusterCountDescription from "../ClusterOptions/ClusterCountDescription";
import ClusterOption from "../ClusterOptions/ClusterOption";
import CustomWorkloadCountDescription from "../ClusterOptions/CustomWorkloadCountDescription";
import DBCountDescription from "../ClusterOptions/DBCountDescription";
import ModuleCountDescription from "../ClusterOptions/ModuleCountDescription";
import IntegerIncrementer from "../IntegerIncrementer";
import { SwitchInput } from "../SwitchInput";
import { getAdjustedPrice } from "../calculatePlanPrice";
import { calculatorStore, setCalculatorStore } from "../calculatorStore";
import {
  CUSTOM_WORKLOAD_DEPLOYMENT_COST,
  DATABASE_DEPLOYMENT_COST,
  MODULE_DEPLOYMENT_COST,
} from "../priceConstants";

const ClusterPrice = (props: { clusterPrice: number; discount: number }) => {
  return (
    <div class="text-nowrap font-machina text-2xl font-semibold md:text-3xl">
      <Show when={props.discount > 0}>
        <span class="text-gray-light-mode-500/80 line-through dark:text-gray-dark-mode-400/80">
          {CURRENCY_FORMAT.format(props.clusterPrice + props.discount)}
        </span>{" "}
      </Show>
      {CURRENCY_FORMAT.format(props.clusterPrice)}{" "}
      <span class="text-nowrap text-sm">/ month</span>
    </div>
  );
};

const DiscountBadge = (props: { discount: number; clusterPrice: number }) => {
  return (
    <Show when={props.discount > 1}>
      <div class="flex h-6 items-center justify-center gap-2 text-nowrap rounded bg-success-100 px-2 py-0 text-xs text-success-800 ring-1 ring-success-500 md:text-sm">
        <span class="-mr-2 sm:hidden">-</span>
        {NUMBER_FORMAT.format(
          (props.discount / (props.clusterPrice + props.discount)) * 100,
        )}
        % <span class="hidden sm:inline">Discount</span>
      </div>
    </Show>
  );
};

const ClusterDescription = (props: { toggleOpen: () => void }) => {
  return (
    <div class="text-secondary text-sm md:text-base">
      We perform end-to-end lifecycle management of a production-ready AWS
      account, Kubernetes cluster, and all associated workloads with dozens of
      bundled addons such as a full observability suite and CI/CD pipelines.{" "}
      <Button
        as="span"
        class="inline underline decoration-dotted decoration-2 underline-offset-4 "
        aria-haspopup="dialog"
        aria-controls={`panfactum-cluster-modal`}
        data-hs-overlay={`#panfactum-cluster-modal`}
        onClick={() => {
          props.toggleOpen();
        }}
      >
        See what is included in each environment for free.
      </Button>
    </div>
  );
};

const UsageOptions: Component<{ clusterPrice: number; discount: number }> = (
  props,
) => {
  const [clusterDetailsOpen, setClusterDetailsOpen] = createSignal(false);
  const toggleClusterDetails = () =>
    setClusterDetailsOpen(!clusterDetailsOpen());
  const [clusterModifiersOpen, setClusterModifiersOpen] = createSignal(false);
  return (
    <div>
      <div class="flex flex-col gap-4 border-b-2 border-gray-light-mode-400 p-4 md:p-8 dark:border-gray-dark-mode-800">
        <div class="flex w-full justify-between">
          <div class="flex w-full flex-col gap-4">
            <div class="flex w-full items-start justify-between gap-x-8 gap-y-2 lg:items-center lg:justify-start">
              <div class="flex items-center gap-8">
                <div class="text-display-md font-machina font-medium">
                  Cloud Environment
                </div>
                <div class="hidden md:block">
                  <SwitchInput
                    label="Customize"
                    labelClass="font-semibold"
                    checked={clusterModifiersOpen()}
                    onChange={(checked) => {
                      setClusterModifiersOpen(checked);
                    }}
                  />
                </div>
              </div>

              <div class="block lg:hidden">
                <IntegerIncrementer
                  minValue={1}
                  value={calculatorStore.clusterCount}
                  onChange={(value) => {
                    setCalculatorStore("clusterCount", value);
                  }}
                />
              </div>
            </div>
            <div class="hidden lg:block">
              <ClusterDescription toggleOpen={toggleClusterDetails} />
            </div>

            <div class="flex justify-between gap-8 lg:hidden">
              <ClusterPrice
                clusterPrice={props.clusterPrice}
                discount={props.discount}
              />
              <DiscountBadge
                discount={props.discount}
                clusterPrice={props.clusterPrice}
              />
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <div class="hidden items-start justify-between gap-4 md:flex-col md:items-end md:justify-start lg:flex">
              <ClusterPrice
                clusterPrice={props.clusterPrice}
                discount={props.discount}
              />
              <DiscountBadge
                discount={props.discount}
                clusterPrice={props.clusterPrice}
              />
              <IntegerIncrementer
                minValue={1}
                value={calculatorStore.clusterCount}
                onChange={(value) => {
                  setCalculatorStore("clusterCount", value);
                }}
              />
            </div>
          </div>
        </div>
        <div class="block lg:hidden">
          <ClusterDescription toggleOpen={toggleClusterDetails} />
        </div>
        <Modal
          open={clusterDetailsOpen()}
          toggleOpen={toggleClusterDetails}
          id="panfactum-cluster-modal"
          title={`Details: Panfactum Cloud Environment`}
        >
          <ClusterCountDescription />
        </Modal>
      </div>
      <Collapsible open={clusterModifiersOpen()}>
        <Collapsible.Content class="flex animate-kobalte-collapsible-up flex-col overflow-hidden border-b-2 border-gray-light-mode-400 data-[expanded]:animate-kobalte-collapsible-down lg:flex-row dark:border-gray-dark-mode-800">
          <ClusterOption
            title="Prebuilt Module"
            price={getAdjustedPrice(MODULE_DEPLOYMENT_COST, calculatorStore)}
            description="We deploy one of our 100+ turn-key infrastructure modules for popular OSS tooling. Examples include Airbyte, n8n, and more."
            value={calculatorStore.moduleCount}
            onChange={(value) => {
              setCalculatorStore("moduleCount", value);
            }}
          >
            <ModuleCountDescription />
          </ClusterOption>
          <ClusterOption
            title="Database"
            price={getAdjustedPrice(DATABASE_DEPLOYMENT_COST, calculatorStore)}
            description="We manage a database such as PostgreSQL, Redis, or NATS backed by our stringent SLAs directly on a Kubernetes cluster for maximum cost savings."
            value={calculatorStore.dbCount}
            onChange={(value) => {
              setCalculatorStore("dbCount", value);
            }}
          >
            <DBCountDescription />
          </ClusterOption>
          <ClusterOption
            title="Custom Workload"
            price={getAdjustedPrice(
              CUSTOM_WORKLOAD_DEPLOYMENT_COST,
              calculatorStore,
            )}
            description="We configure, harden, and deploy one of your containerized workloads to a Panfactum Kubernetes cluster. Includes end-to-end development of the necessary infrastructure-as-code, CI/CD setup, and observabiltiy integrations."
            value={calculatorStore.workloadCount}
            onChange={(value) => {
              setCalculatorStore("workloadCount", value);
            }}
          >
            <CustomWorkloadCountDescription />
          </ClusterOption>
        </Collapsible.Content>
      </Collapsible>
    </div>
  );
};

export default UsageOptions;
