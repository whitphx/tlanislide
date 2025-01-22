import React from "react";
import { draggableFrameDOMContext } from "./draggableFrameDOMContext";

/**
 * When the user drags a frame,
 * the frame should move together with other frames in the same track.
 * This hook provides the delta value to move each draggable frame element.
 */
interface UseDraggableFrameDeltaReturn {
  registerDOM: (node: HTMLElement | null) => void;
  deltaX: number | null;
}
export function useDraggableFrameDelta(
  trackId: string,
  trackIndex: number,
): UseDraggableFrameDeltaReturn {
  const context = React.useContext(draggableFrameDOMContext);
  if (context == null) {
    throw new Error(
      "useDraggableFrameDelta must be used within a DraggableFrameDeltaProvider",
    );
  }

  return {
    registerDOM: context.registerDOM.bind(null, trackId, trackIndex),
    deltaX: context.draggableDOMDeltaXs?.[trackId]?.[trackIndex] ?? null,
  };
}
