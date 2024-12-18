import { persistentAtom, persistentMap } from '@nanostores/persistent'
import { computed } from 'nanostores'
import { stripBasePath } from '@/components/documentation/DocsSidebar/SideNavVersions.ts'
import { Versions } from '@/lib/constants.ts'

export const scrollYStore = persistentAtom('scrollY', undefined)

const LAST_SECTION_STORE_KEY = 'navigationReferences:'
const DOCUMENTATION_STORE_KEY = 'documentation:'

export const sectionLastPath = persistentMap<Record<string, string>>(
  LAST_SECTION_STORE_KEY,
  {},
)

export type DocumentationStore = {
  version: string
  lastPath?: string
  scrollY?: string
}

export const documentationStore = persistentMap<DocumentationStore>(
  DOCUMENTATION_STORE_KEY,
  {
    version: Versions.edge,
  },
)

export const lastDocumentationPath = computed([documentationStore], (store) => {
  return store.lastPath
})

export function setNavigationReferences(rootPath: string, lastPath: string) {
  const { path, version, isVersionedPath } = stripBasePath(lastPath)
  const sectionKey = `${isVersionedPath ? version : ''}${rootPath}`

  sectionLastPath.setKey(sectionKey, path)
  documentationStore.setKey(
    'lastPath',
    `${isVersionedPath ? `${version}/` : ''}${path}`,
  )

  if (isVersionedPath && version) {
    setVersion(version)
  }
}

export function setVersion(version: string) {
  documentationStore.setKey('version', version)
}

export function getStoredY() {
  return scrollYStore.get()
}
