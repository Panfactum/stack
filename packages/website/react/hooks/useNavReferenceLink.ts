import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { stripBasePath } from "@/components/documentation/DocsSidebar/SideNavVersions.ts";
import {
  sectionLastPath,
  lastDocumentationPath,
  documentationStore,
} from "@/stores/documentation-store.ts";

export function useNavReferenceLink(defaultLink: string) {
  const $navRefStore = useStore(sectionLastPath);
  const [link, setLink] = useState<string>(defaultLink);
  const { path, version, isVersionedPath } = stripBasePath(defaultLink);
  const sectionKey = `${isVersionedPath ? version : ""}/${path}`;

  const ref = $navRefStore[sectionKey];

  useEffect(() => {
    let shouldUpdate = true;
    setLink(defaultLink);

    if (ref) {
      const verifyLink = `/docs/${isVersionedPath ? version + "/" : ""}${ref}`;

      void fetch(verifyLink, { method: "HEAD" })
        .then((res) => res.ok)
        .catch((_) => false)
        .then((res) => {
          if (shouldUpdate && res) {
            setLink(verifyLink);
          }
        });
    }
  }, [defaultLink]);

  return {
    link,
  };
}

export function useLastDocumentationPath() {
  const [link, setLink] = useState<string | null>();
  const $lastDocumentationPath = useStore(lastDocumentationPath);

  useEffect(() => {
    let shouldUpdate = true;

    if ($lastDocumentationPath) {
      void fetch(`/docs/${$lastDocumentationPath}`, { method: "HEAD" })
        .then((res) => res.ok)
        .catch((_) => false)
        .then((res) => {
          if (shouldUpdate && res) {
            setLink($lastDocumentationPath);
          }
        });
    }

    return () => {
      shouldUpdate = false;
    };
  }, [$lastDocumentationPath]);

  return {
    link,
  };
}

export function useGetStartedLink() {
  const [link, setLink] = useState<string>(
    "/docs/edge/guides/getting-started/start-here",
  );
  const $documentationStore = useStore(documentationStore);

  const verifyLink = `/docs/${$documentationStore.version}/guides/getting-started/start-here`;

  useEffect(() => {
    void fetch(verifyLink, { method: "HEAD" })
      .then((res) => res.ok)
      .catch((_) => false)
      .then((res) => {
        if (res) {
          setLink(verifyLink);
        }
      });
  }, [$documentationStore]);

  return {
    link,
  };
}
