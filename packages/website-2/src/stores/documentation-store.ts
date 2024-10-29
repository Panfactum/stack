import { persistentMap } from '@nanostores/persistent'
import { computed } from 'nanostores'
import { isValidVersion, Versions } from '@/lib/constants.ts'

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

  sectionLastPath.setKey(rootPath, path)
  documentationStore.setKey(
    'lastPath',
    `${isVersionedPath ? `${version}/` : ''}${path}`,
  )

  if (isVersionedPath) {
    setVersion(version)
  }
}

export function setVersion(version: string) {
  documentationStore.setKey('version', version)
}

export function stripBasePath(currentPath: string) {
  const [_, docRoot, version, ...pathArr] = currentPath.split('/')

  const isVersionedPath = isValidVersion(version)

  const path = isVersionedPath
    ? pathArr.join('/')
    : [version, ...pathArr].join('/')

  return { path, version, isVersionedPath }
}
