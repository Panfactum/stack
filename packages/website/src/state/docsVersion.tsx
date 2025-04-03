import { navigate } from "astro:transitions/client";
import {
  createContext,
  createMemo,
  createSignal,
  onMount,
  type ParentComponent,
  useContext,
} from "solid-js";
import { isServer } from "solid-js/web";

import { DOCS_BASE_PATH } from "@/pages/docs/_components/constants.ts";
import { getDocsPathComponents } from "@/pages/docs/_components/util/getDocsPathComponents.ts";

/*
  The active docs version is determined by the following (in order of precendence):

  1. The page path; if ambiguous,
  2. The internal _docsVersion store

  This ensures that the correct content is statically rendered by astro (in most circumstances).

  We use the DocsVersionProvider to ensure that they are kept in sync (after client hydration).

  In order for this to work properly:

  1. You should ALWAYS access the docs version via `useDocsVersion` (and thus set the DocsVersionProvider at the component root)

  2. You should ALWAYS set the docs version via the `setDocsVersion` function.
 */

type DocsVersionContext = [() => string, (v: string) => void];
const docsVersionContext = createContext<DocsVersionContext>();
const STATE_KEY = "pf-active-version";
export const DocsVersionProvider: ParentComponent<{ fullPath: string }> = (
  props,
) => {
  const versionFromPath = () => getDocsPathComponents(props.fullPath).version;

  const [_docsVersion, _setDocsVersion] = createSignal<string>("edge");

  const setDocsVersion = (newVersion: string) => {
    if (!isServer) {
      const pathname = window.location.pathname;
      if (pathname.startsWith(`${DOCS_BASE_PATH}/${_docsVersion()}`)) {
        const suffix = pathname.substring(
          `${DOCS_BASE_PATH}/${_docsVersion()}`.length,
        );
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
        void navigate(`${DOCS_BASE_PATH}/${newVersion}${suffix}`);
      }
      setTimeout(() => {
        window.localStorage.setItem(STATE_KEY, newVersion);
      }, 0);
    }
    _setDocsVersion(newVersion);
  };

  // Synchronizes the internal store with the page path on mount
  onMount(() => {
    const v = versionFromPath();
    if (v) {
      _setDocsVersion(v);
    } else {
      // Note to future self: Do NOT try to use makePersisted / persistentAtom
      // as it will not actually trigger the update.
      // Note sure wtf is going on with that, but this custom handling works just fine.
      setTimeout(() => {
        const savedVersion = window.localStorage.getItem(STATE_KEY);
        if (savedVersion) {
          _setDocsVersion(savedVersion);
        }
      }, 0);
    }
  });

  const docsVersion = createMemo(() => versionFromPath() ?? _docsVersion());

  const value: DocsVersionContext = [docsVersion, setDocsVersion];

  // Always default to the version from the path and only fallback to the internal state
  // if absolutely necessary
  return (
    <docsVersionContext.Provider value={value}>
      {props.children}
    </docsVersionContext.Provider>
  );
};

export const useDocsVersion = () => {
  const v = useContext(docsVersionContext);
  if (v === undefined) {
    throw new Error(
      "Cannot call useDocsVersion if DocsVersionProvider is not an ancestor component.",
    );
  }
  return v;
};
