import { Toast } from "@kobalte/core/toast";
import type {Component} from "solid-js";
import {Portal} from "solid-js/web";

const ToastRegion: Component = () => {
  return (
    <Portal>
      <Toast.Region>
        <Toast.List
          class="fixed bottom-0 right-0 z-[1000] flex w-192 max-w-[100vw] list-none flex-col items-end gap-8 p-16"
        />
      </Toast.Region>
    </Portal>
  )
}

export default ToastRegion;