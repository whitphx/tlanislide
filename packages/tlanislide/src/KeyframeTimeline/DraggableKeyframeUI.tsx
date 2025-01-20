import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useDraggableKeyframeDelta } from "./KeyframeMoveTogetherDndContext";
import { FrameBatch, SubFrame } from "../models";

interface DraggableUIPayloadBase {
  type: string;
}
interface DraggableUIPayloadFrameBatch extends DraggableUIPayloadBase {
  type: "frameBatch";
  id: FrameBatch["id"];
}
interface DraggableUIPayloadSubFrame extends DraggableUIPayloadBase {
  type: "subFrame";
  id: SubFrame["id"];
}

export type DraggableUIPayload =
  | DraggableUIPayloadFrameBatch
  | DraggableUIPayloadSubFrame;
export function DraggableKeyframeUI({
  id,
  trackId,
  localIndex,
  payload,
  children,
  className,
}: {
  id: string;
  trackId: string;
  localIndex: number;
  payload: DraggableUIPayload;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging, active } =
    useDraggable({
      id,
      data: {
        payload,
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
      className={className}
    >
      {children}
    </div>
  );
}
