import {createSignal, type ParentComponent, Show} from "solid-js";

import InfoIcon from "@/components/inputs/InfoIcon.tsx";
import Modal from "@/components/ui/Modal.tsx";
import {CURRENCY_FORMAT} from "@/lib/utils.ts";

interface InputRowPriceProps {
  price: number;
  perCluster?: boolean;
}

const InputRowPrice: ParentComponent<InputRowPriceProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const toggleOpen = () => setOpen(open => !open)
  return (
    <span class="text-secondary font-semibold xl:col-span-2">
      <Show when={props.perCluster} fallback={`x ${CURRENCY_FORMAT.format(props.price)}`}>
        <button
          onClick={toggleOpen}
          class="flex cursor-pointer items-center gap-4"
          aria-haspopup={"dialog"}
        >
          <span>x {CURRENCY_FORMAT.format(props.price)} per cluster</span>
         <div class="w-4"><InfoIcon/></div>
        </button>
      </Show>
      <Modal
        open={open()}
        toggleOpen={toggleOpen}
        id={'per-cluster-details'}
        title={`Per Cluster Details`}
      >
        <div class="flex max-w-screen-md flex-col gap-4 font-normal">
                            <p>
          We charge for each workload{" "}<em>deployment</em>{" "}as much of our
          support is focused on keeping your workloads healthy, efficient, and
          performant in{" "}<em>each</em>{" "}cluster they are deployed to.
        </p>
            <p>
          This calculator assumes your workloads will be deployed to all clusters,
          but this does not necessarily need to be the case when creating your
          support contract. This means this calculator shows a price{" "}<em>ceiling</em>.
        </p>
            <p>
          If you are deploying the same workload multiple times to the same cluster with substantially
              similar settings (e.g., blue-green deployments, testing, etc.), you would only be billing
              for a{" "}<em>single</em>{" "} deployment.
        </p>
        </div>

      </Modal>
    </span>
  );
};

export default InputRowPrice;
