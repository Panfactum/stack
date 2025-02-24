import {clsx} from "clsx";
import {type ParentComponent} from "solid-js";

interface DocumentationArticleProps {
  showTOC: boolean;
}

const DocumentationArticle: ParentComponent<DocumentationArticleProps> = (props) => {
  return (
    <article
      class={clsx(
        "content mt-0 size-full max-w-full px-6 pt-6 md:mt-16 lg:ml-[--sidebar-width] lg:mt-[--header-height] lg:w-[calc(100%_-_var(--sidebar-width))]",
        props.showTOC ? "xl:w-[calc(100%_-_var(--sidebar-width)_-_var(--toc-width))]" : "",
      )}
    >
      {props.children}
    </article>
  )
}

export default DocumentationArticle
