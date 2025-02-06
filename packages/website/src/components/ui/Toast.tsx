import {Toast as KobalteToast} from "@kobalte/core/toast";
import {type ParentComponent, Show} from "solid-js";

interface ToastProps {
  id: number;
  title: string;
  description?: string;
}

const Toast: ParentComponent<ToastProps> = (props) => {
  return (
    <KobalteToast
      toastId={props.id}
      class="toast [data-opened]"
    >
      <div class="bg-primary rounded-xl border-2 border-gray-light-mode-500 p-6">
        <div>
          <KobalteToast.Title>{props.title}</KobalteToast.Title>
          <Show when={props.description}>
            <KobalteToast.Description>
              {props.description}
            </KobalteToast.Description>
          </Show>
        </div>
      </div>
    </KobalteToast>
  )
}

export default Toast;