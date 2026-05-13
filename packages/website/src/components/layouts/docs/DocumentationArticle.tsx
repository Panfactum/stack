import { type ParentComponent } from "solid-js";

import "./global.css";

const DocumentationArticle: ParentComponent = (props) => {
  return (
    <article
      class={`
        content flex min-w-0 max-w-full flex-1 flex-col self-stretch px-6 pt-6
      `}
    >
      {props.children}
    </article>
  );
};

export default DocumentationArticle;
