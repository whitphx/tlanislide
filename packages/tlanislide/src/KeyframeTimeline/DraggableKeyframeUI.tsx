import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { KeyframeUIData } from "./keyframe-ui-data";
import { useDraggableKeyframeDelta } from "./KeyframeMoveTogetherDndContext";

export function DraggableKeyframeUI({
  kf,
  trackId,
  localIndex,
  children,
}: {
  kf: KeyframeUIData;
  trackId: string;
  localIndex: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging, active } =
    useDraggable({
      id: kf.id,
      data: {
        trackId,
        localIndex,
      },
    });
  const { registerDOM, deltaX } = useDraggableKeyframeDelta(
    trackId,
    localIndex,
  );
  const transformX = deltaX != null ? deltaX : (transform?.x ?? 0);
  const transformY = transform?.y ?? 0;
  const isDraggingSomething = active != null;
  const style: React.CSSProperties = {
    transform: `translate(${transformX}px, ${transformY}px)`,
    transition: isDraggingSomething ? undefined : "transform 0.3s",
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerDOM(trackId, localIndex, node);
      }}
      {...attributes}
      {...listeners}
      style={style}
    >
      {children}
    </div>
  );
}
