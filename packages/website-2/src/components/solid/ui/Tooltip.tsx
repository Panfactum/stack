import {Tooltip as KobalteTooltip} from "@kobalte/core/tooltip";
import {type Component, createSignal, type ParentComponent, Show} from "solid-js";

interface TooltipProps {
  content: Component | string;
}

const Tooltip: ParentComponent<TooltipProps> = (props) => {

  const [open, setOpen] = createSignal(false);

  // The default component doesn't open on click which is a PITA for mobile users
  // so we extend its functionality with the click toggle behavior
  const [clickOpen, setClickOpen] = createSignal(false)

  return (
    <KobalteTooltip
      open={open()}
      onOpenChange={(val) => {
        if(!val && clickOpen()) {
          setClickOpen(false)
        } else {
          setOpen(val)
        }
      }}
      openDelay={200}
    >
      <KobalteTooltip.Trigger on:click={() => {
        setOpen(true)
        setClickOpen(true)
      }}>
        {props.children}
      </KobalteTooltip.Trigger>
      <KobalteTooltip.Portal>
        <KobalteTooltip.Content
          class="bg-secondary z-[200] max-w-[80vw] border-2 border-offWhite p-4"
          onPointerDownOutside={() => {
            setOpen(false)
            setClickOpen(false)
          }}
        >
          <KobalteTooltip.Arrow />
          <Show
            when={typeof props.content === "string"}
            fallback={<props.content/>}
          >
            {props.content}
          </Show>
          <props.content/>
        </KobalteTooltip.Content>
      </KobalteTooltip.Portal>
    </KobalteTooltip>
  )
}

export default Tooltip;