import {Accordion} from "@kobalte/core/accordion";
import { FiPlusCircle } from 'solid-icons/fi'
import type {ParentComponent} from "solid-js";

interface FAQItemProps {
  title: string;
  id: string;
}

const FAQItem: ParentComponent<FAQItemProps> = (props) => {
  return (
      <Accordion.Item value={props.id} class="border-b-2 border-gray-light-mode-500 py-4 last:border-0 dark:border-gray-dark-mode-700">
      <Accordion.Header class="[&[data-expanded]_svg]:rotate-45">
        <Accordion.Trigger
          class="text-display-sm flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left font-semibold"
        >
          {props.title}
          <FiPlusCircle class="self-start transition-all" size={28}/>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content class="text-secondary faq-content text-display-xs flex flex-col gap-4 overflow-hidden [&_a]:underline [&_a]:hover:cursor-pointer">
        {props.children}
      </Accordion.Content>
    </Accordion.Item>
  )
}

export default FAQItem