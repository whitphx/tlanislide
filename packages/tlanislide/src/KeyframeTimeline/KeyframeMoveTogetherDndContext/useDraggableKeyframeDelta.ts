import React from "react";
import { draggableKeyframeDOMContext } from "./draggableKeyframeDOMContext";

/**
 * When the user drags a keyframe,
 * the keyframe should move together with other keyframes in the same track
 * to demonstrate the `moveKeyframe()`'s effect.
 * This hook provides the delta value to move each keyframe draggable element.
 */
interface UseDraggableKeyframeDeltaReturn {
  registerDOM: (node: HTMLElement | null) => void;
  deltaX: number | null;
}
export function useDraggableKeyframeDelta(
  trackId: string,
  localIndex: number,
): UseDraggableKeyframeDeltaReturn {
  const context = React.useContext(draggableKeyframeDOMContext);
  if (context == null) {
    throw new Error(
      "useDraggableKeyframeDelta must be used within a DraggableKeyframeDeltaProvider",
    );
  }

  return {
    registerDOM: context.registerDOM.bind(null, trackId, localIndex),
    deltaX: context.draggableDOMDeltaXs?.[trackId]?.[localIndex] ?? null,
  };
}
