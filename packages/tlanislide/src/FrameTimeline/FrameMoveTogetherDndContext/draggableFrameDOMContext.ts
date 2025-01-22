import React from "react";

type DraggableFrameDOMDeltaXs = Record<string, Record<number, number>>; // obj[trackId][trackIndex] = delta

export interface DraggableFrameDOMContext {
  registerDOM: (
    trackId: string,
    trackIndex: number,
    node: HTMLElement | null,
  ) => void;
  draggableDOMDeltaXs: DraggableFrameDOMDeltaXs | null;
}
export const draggableFrameDOMContext =
  React.createContext<DraggableFrameDOMContext | null>(null);
