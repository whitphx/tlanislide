import React from "react";

type DraggableKeyframeDOMDeltaXs = Record<string, Record<number, number>>; // obj[trackId][trackIndex] = delta

export interface DraggableKeyframeDOMContext {
  registerDOM: (
    trackId: string,
    trackIndex: number,
    node: HTMLElement | null,
  ) => void;
  draggableDOMDeltaXs: DraggableKeyframeDOMDeltaXs | null;
}
export const draggableKeyframeDOMContext =
  React.createContext<DraggableKeyframeDOMContext | null>(null);
