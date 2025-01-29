import { createContext, useContext } from "solid-js";

export type Background = "primary" | "secondary";

export const BackgroundContext = createContext<Background>();

export const useBackgroundContext = () => {
  return useContext(BackgroundContext) || "primary";
};
