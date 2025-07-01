import { clsx } from "clsx";
import { type ParentComponent } from "solid-js";

import "./global.css";

interface DocumentationArticleProps {
  showTOC: boolean;
}

const DocumentationArticle: ParentComponent<DocumentationArticleProps> = (
  props,
) => {
  return (
    <article
      class={clsx(
        `
          content mt-0 size-full max-w-full px-6 pt-6
          md:mt-16
          lg:mt-(--header-height) lg:ml-(--sidebar-width)
          lg:w-[calc(100%_-_var(--sidebar-width))]
        `,
        props.showTOC
          ? "xl:w-[calc(100%_-_var(--sidebar-width)_-_var(--toc-width))]"
          : "",
      )}
    >
      {props.children}
    </article>
  );
};

export default DocumentationArticle;
