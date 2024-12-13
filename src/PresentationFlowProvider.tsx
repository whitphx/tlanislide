import React from "react";
import { PresentationFlow } from "./presentation-flow";
import { PresentationFlowContext } from "./PresentationFlowContext";

export function PresentationFlowProvider(props: { children: React.ReactNode }) {
  const flow = new PresentationFlow();

  return (
    <PresentationFlowContext.Provider value={flow}>
      {props.children}
    </PresentationFlowContext.Provider>
  );
}
