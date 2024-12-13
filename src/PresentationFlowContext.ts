import React from "react";
import type { PresentationFlow } from "./presentation-flow"

export const PresentationFlowContext = React.createContext<PresentationFlow | null>(null);

export function usePresentationFlow(): PresentationFlow {
  const flow = React.useContext(PresentationFlowContext);
  if (flow == null) {
    throw new Error("PresentationFlow not found in context");
  }
  return flow;
}
