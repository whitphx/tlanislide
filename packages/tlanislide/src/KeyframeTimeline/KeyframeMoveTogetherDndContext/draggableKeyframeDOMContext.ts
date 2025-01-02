import React from "react";

type DraggableKeyframeDOMDeltaXs = Record<string, Record<number, number>>; // obj[trackId][localIndex] = delta

export interface DraggableKeyframeDOMContext {
  registerDOM: (
    trackId: string,
    localIndex: number,
    node: HTMLElement | null,
  ) => void;
  draggableDOMDeltaXs: DraggableKeyframeDOMDeltaXs | null;
}
export const draggableKeyframeDOMContext =
  React.createContext<DraggableKeyframeDOMContext | null>(null);
