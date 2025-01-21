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
  trackIndex: trackIndex,
  payload,
  children,
  className,
}: {
  id: string;
  trackId: string;
  trackIndex: number;
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
        trackIndex,
      },
    });
  const { registerDOM, deltaX } = useDraggableKeyframeDelta(
    trackId,
    trackIndex,
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
        registerDOM(node);
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
