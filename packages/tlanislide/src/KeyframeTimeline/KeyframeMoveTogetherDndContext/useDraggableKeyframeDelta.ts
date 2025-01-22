import React from "react";
import { draggableKeyframeDOMContext } from "./draggableKeyframeDOMContext";

/**
 * When the user drags a frame,
 * the frame should move together with other frames in the same track.
 * This hook provides the delta value to move each draggable frame element.
 */
interface UseDraggableKeyframeDeltaReturn {
  registerDOM: (node: HTMLElement | null) => void;
  deltaX: number | null;
}
export function useDraggableKeyframeDelta(
  trackId: string,
  trackIndex: number,
): UseDraggableKeyframeDeltaReturn {
  const context = React.useContext(draggableKeyframeDOMContext);
  if (context == null) {
    throw new Error(
      "useDraggableKeyframeDelta must be used within a DraggableKeyframeDeltaProvider",
    );
  }

  return {
    registerDOM: context.registerDOM.bind(null, trackId, trackIndex),
    deltaX: context.draggableDOMDeltaXs?.[trackId]?.[trackIndex] ?? null,
  };
}
