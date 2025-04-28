import type { DefaultRenderer, ListrTaskWrapper, SimpleRenderer } from "listr2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PanfactumTaskWrapper<Ctx = any | undefined> = ListrTaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>