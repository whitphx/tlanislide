import React, { useCallback, useMemo, useRef, useState } from "react";
import { DndContext, type DndContextProps } from "@dnd-kit/core";
import {
  draggableKeyframeDOMContext,
  type DraggableKeyframeDOMContext,
} from "./draggableKeyframeDOMContext";

interface KeyframeDraggingState {
  trackId: string;
  localIndex: number;
  deltaX: number;
}
type DraggableKeyframeDOMs = Record<string, (HTMLElement | null)[]>; // obj[trackId][localIndex] = HTMLElement | null

export function KeyframeMoveTogetherDndContext({
  children,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  ...dndContextProps
}: {
  children: React.ReactNode;
} & DndContextProps) {
  const [draggingState, setDraggingState] =
    useState<KeyframeDraggingState | null>(null);

  const handleDragMove = useCallback<
    NonNullable<DndContextProps["onDragMove"]>
  >(
    (event) => {
      const { active, delta } = event;
      const trackId = active.data.current?.trackId;
      const localIndex = active.data.current?.localIndex;
      if (typeof trackId === "string" && typeof localIndex === "number") {
        setDraggingState({
          trackId,
          localIndex,
          deltaX: delta.x,
        });
      }

      onDragMove?.(event);
    },
    [onDragMove],
  );

  const handleDragEnd = useCallback<NonNullable<DndContextProps["onDragEnd"]>>(
    (event) => {
      setDraggingState(null);
      onDragEnd?.(event);
    },
    [onDragEnd],
  );
  const handleDragCancel = useCallback<
    NonNullable<DndContextProps["onDragCancel"]>
  >(
    (event) => {
      setDraggingState(null);
      onDragCancel?.(event);
    },
    [onDragCancel],
  );

  const draggableDOMsRef = useRef<DraggableKeyframeDOMs>({});
  const registerDOM = useCallback<DraggableKeyframeDOMContext["registerDOM"]>(
    (trackId, localIndex, node) => {
      const draggableDOMs = draggableDOMsRef.current;
      if (!draggableDOMs[trackId]) {
        draggableDOMs[trackId] = Array(localIndex + 1).fill(null);
      } else if (draggableDOMs[trackId].length < localIndex + 1) {
        draggableDOMs[trackId] = [
          ...draggableDOMs[trackId],
          ...Array(localIndex + 1 - draggableDOMs[trackId].length).fill(null),
        ];
      }
      draggableDOMs[trackId][localIndex] = node;
      draggableDOMsRef.current = draggableDOMs;
    },
    [],
  );

  const draggableDOMOrgRectsRef = useRef<Record<string, (DOMRect | null)[]>>(
    {},
  );
  const initializeDOMRects = useCallback(() => {
    const draggableDOMs = draggableDOMsRef.current;
    const draggableDOMOrgRects: Record<string, (DOMRect | null)[]> = {};
    for (const trackId in draggableDOMs) {
      draggableDOMOrgRects[trackId] = draggableDOMs[trackId].map((dom) => {
        if (dom == null) {
          return null;
        }
        return dom.getBoundingClientRect();
      });
    }
    draggableDOMOrgRectsRef.current = draggableDOMOrgRects;
  }, []);
  const handleDragStart = useCallback<
    NonNullable<DndContextProps["onDragStart"]>
  >(
    (...args) => {
      initializeDOMRects();
      onDragStart?.(...args);
    },
    [initializeDOMRects, onDragStart],
  );

  const draggableDOMDeltaXs = useMemo(() => {
    if (draggingState == null) {
      return null;
    }
    const { trackId, localIndex, deltaX: delta } = draggingState;

    const draggableDOMOrgRects = draggableDOMOrgRectsRef.current;
    const rectsInTrack = draggableDOMOrgRects[trackId];
    if (rectsInTrack == null) {
      return null;
    }

    const selfRect = rectsInTrack[localIndex];
    if (selfRect == null) {
      return null;
    }

    if (delta > 0) {
      const draggableDOMDeltaXs: Record<number, number> = {};
      // Dragging right
      let right = selfRect.right + delta;
      for (let i = localIndex + 1; i < rectsInTrack.length; i++) {
        const domRect = rectsInTrack[i];
        if (domRect == null) continue;
        if (domRect.left < right) {
          const delta = right - domRect.left;
          draggableDOMDeltaXs[i] = delta;
          right = right + domRect.width;
        } else {
          break;
        }
      }
      return { [trackId]: draggableDOMDeltaXs };
    } else if (delta < 0) {
      // Dragging left
      const draggableDOMDeltaXs: Record<number, number> = {};
      let left = selfRect.left + delta;
      for (let i = localIndex - 1; i >= 0; i--) {
        const domRect = rectsInTrack[i];
        if (domRect == null) continue;
        if (left < domRect.right) {
          const delta = left - domRect.right;
          draggableDOMDeltaXs[i] = delta;
          left = left - domRect.width;
        } else {
          break;
        }
      }
      return { [trackId]: draggableDOMDeltaXs };
    }

    return null;
  }, [draggingState]);

  return (
    <draggableKeyframeDOMContext.Provider
      value={{
        registerDOM,
        draggableDOMDeltaXs,
      }}
    >
      <DndContext
        {...dndContextProps}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
      </DndContext>
    </draggableKeyframeDOMContext.Provider>
  );
}
