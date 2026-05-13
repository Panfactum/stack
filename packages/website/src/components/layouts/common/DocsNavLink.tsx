import { createSignal, onMount, type Component } from "solid-js";

interface IDocsNavLinkProps {
  class?: string;
}

const VERSION_STORAGE_KEY = "pf-active-version";
const PAGE_SESSION_KEY = "pf-docs-last-page";
const DEFAULT_VERSION = "edge";

// Tracks the last-visited docs page (any version) and uses the saved version
// preference from localStorage to restore the correct docs section on return visits.
export const DocsNavLink: Component<IDocsNavLinkProps> = (props) => {
  const [href, setHref] = createSignal(`/docs/${DEFAULT_VERSION}/guides`);

  const updateIfOnDocsPage = () => {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/docs/")) {
      window.sessionStorage.setItem(PAGE_SESSION_KEY, pathname);
      setHref(pathname);
    }
  };

  onMount(() => {
    // Within-session: restore the last docs page visited (any version)
    const lastPage = window.sessionStorage.getItem(PAGE_SESSION_KEY);
    if (lastPage) {
      setHref(lastPage);
    } else {
      // Cross-session: use the saved version preference from localStorage
      const savedVersion =
        window.localStorage.getItem(VERSION_STORAGE_KEY) ?? DEFAULT_VERSION;
      setHref(`/docs/${savedVersion}/guides`);
    }

    window.document.addEventListener("astro:page-load", updateIfOnDocsPage);
  });

  return (
    <a href={href()} class={props.class} data-astro-prefetch="hover">
      Docs
    </a>
  );
};
