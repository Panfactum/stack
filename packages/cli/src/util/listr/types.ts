import type { DefaultRenderer, ListrTaskWrapper, SimpleRenderer } from "listr2";

export type PanfactumTaskWrapper = ListrTaskWrapper<unknown, typeof DefaultRenderer, typeof SimpleRenderer>