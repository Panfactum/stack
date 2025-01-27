import { prefetch } from "astro:prefetch";
import {
  createSignal,
  onMount,
  type ParentComponent,
  type JSX,
  splitProps, createEffect, createMemo,
} from "solid-js";

import { simpleHash } from "@/lib/simpleHash";

type SavedLinkProps = {
  defaultHref: string;

  // This provides a "nice" name for the saved state for debugging purposes
  // however to avoid conflicts we also append a hash of the defaultHref to the state key
  id: string;

  // Iff ture, the href will be replaced with the user's last visited page that is "inside" the href (e.g., '/docs' -> '/docs/a/b/c`)
  // This only persists for the user's session as we don't want to lock users out of particular pages
  saveEnabled?: boolean;
} & JSX.AnchorHTMLAttributes<HTMLAnchorElement>;

const SavedLink: ParentComponent<SavedLinkProps> = (props) => {
  const [linkProps, rest] = splitProps(props, [
    "defaultHref",
    "id",
    "saveEnabled",
  ]);

  const [href, _setHref] = createSignal<string>(linkProps.defaultHref);

  const stateKey = createMemo(() =>
    `pf-saved-href-${linkProps.id.replace(/[^a-zA-Z0-9]/g, "-")}-${simpleHash(linkProps.defaultHref)}`);

  // Ensures that we update the in-memory signal AND the
  // browser session storage
  const setHref = (path: string) => {
    window.sessionStorage.setItem(stateKey(), path);
    _setHref(path);
  };

  // This will ONLY update the state if the current page path
  /// is a child of the current one
  const updateState = () => {
    const pathname = window.location.pathname;
    if (pathname.startsWith(linkProps.defaultHref)) {
      setHref(pathname);
    }
  };

  onMount(() => {
    if (linkProps.saveEnabled) {
      // If there is a saved state, load it; otherwise save the current location
      const savedState = window.sessionStorage.getItem(stateKey());
      if (savedState) {
        _setHref(savedState);
      } else {
        updateState();
      }

      // Need to listen to this particular event due to the way astro works
      // in order to detect when a page changes
      window.document.addEventListener("astro:page-load", updateState);
    }
  });

  // This handles updating the button if the defaultHref
  // every changes
  createEffect(() => {
    if (linkProps.saveEnabled) {
      const savedState = window.sessionStorage.getItem(stateKey());
      if (savedState) {
        _setHref(savedState);
      } else {
        _setHref(linkProps.defaultHref);
        updateState();
      }
    }
  })

  return (
    <a
      {...rest}
      href={href()}
      on:mouseenter={() => {
        prefetch(href());
      }}
    >
      {props.children}
    </a>
  );
};

export default SavedLink;
