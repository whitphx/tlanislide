import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  useSensors,
  useSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  DndContextProps,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  Keyframe,
  getAllLocalSequencesWithGlobalOrder,
  moveKeyframe,
} from "./keyframe";
import type { JsonObject } from "tldraw";
import styles from "./KeyframeTimeline.module.scss";

interface KeyframeUIData {
  id: string;
  trackId: string;
  localIndex: number;
}

interface Track {
  id: string;
}

interface KeyframeDraggingState {
  trackId: string;
  localIndex: number;
  delta: number;
}
type DraggableKeyframeDOMs = Record<string, (HTMLElement | null)[]>; // obj[trackId][localIndex] = HTMLElement | null
type DraggableKeyframeDOMDeltas = Record<string, Record<number, number>>; // obj[trackId][localIndex] = delta
interface DraggableKeyframeDOMContext {
  registerDOM: (
    trackId: string,
    localIndex: number,
    node: HTMLElement | null
  ) => void;
  draggableElementDeltas: DraggableKeyframeDOMDeltas | null;
}
const draggableKeyframeDOMContext =
  React.createContext<DraggableKeyframeDOMContext | null>(null);

function DraggableKeyframeDeltaProvider({
  children,
  draggingState,
  maxGlobalIndex,
}: {
  children: React.ReactNode;
  draggingState: KeyframeDraggingState | null;
  maxGlobalIndex: number;
}) {
  const draggableDOMsRef = useRef<DraggableKeyframeDOMs>({});
  const registerDOM = useCallback<DraggableKeyframeDOMContext["registerDOM"]>(
    (trackId, localIndex, node) => {
      const draggableDOMs = draggableDOMsRef.current;
      if (!draggableDOMs[trackId]) {
        draggableDOMs[trackId] = Array(maxGlobalIndex + 1).fill(null);
      } else if (draggableDOMs[trackId].length < maxGlobalIndex + 1) {
        draggableDOMs[trackId] = [
          ...draggableDOMs[trackId],
          ...Array(maxGlobalIndex + 1 - draggableDOMs[trackId].length).fill(
            null
          ),
        ];
      }
      draggableDOMs[trackId][localIndex] = node;
      draggableDOMsRef.current = draggableDOMs;
    },
    [maxGlobalIndex]
  );

  const draggableElementDeltas = useMemo(() => {
    const draggableDOMs = draggableDOMsRef.current;

    if (draggingState == null) {
      return null;
    }
    const { trackId, localIndex, delta } = draggingState;

    const domsInTrack = draggableDOMs[trackId];
    if (domsInTrack == null) {
      return null;
    }

    const selfDOM = domsInTrack[localIndex];
    if (selfDOM == null) {
      return null;
    }

    function getRect(dom: HTMLElement): {
      width: number;
      right: number;
      left: number;
    } {
      // Use `selfDOM.offsetLeft` to get the position ignoring the `translate()` CSS property,
      // which is needed to calculate the correct position combined with `delta`.
      // In contrast, use `selfDOM.getBoundingClientRect().width` to get the actual width including the `translate()` property's effect.
      const width = dom.getBoundingClientRect().width;
      return {
        width,
        left: dom.offsetLeft,
        right: dom.offsetLeft + width,
      };
    }

    const selfRect = getRect(selfDOM);

    if (delta > 0) {
      const draggableElementDeltas: Record<number, number> = {};
      //
      let right = selfRect.right + delta;
      for (let i = localIndex + 1; i < domsInTrack.length; i++) {
        const dom = domsInTrack[i];
        if (dom == null) continue;
        const domRect = getRect(dom);
        if (domRect.left < right) {
          const delta = right - domRect.left;
          draggableElementDeltas[i] = delta;
          right = right + domRect.width;
        } else {
          break;
        }
      }
      return { [trackId]: draggableElementDeltas };
    } else if (delta < 0) {
      // Dragging left
      const draggableElementDeltas: Record<number, number> = {};
      let left = selfRect.left + delta;
      for (let i = localIndex - 1; i >= 0; i--) {
        const dom = domsInTrack[i];
        if (dom == null) continue;
        const domRect = getRect(dom);
        if (left < domRect.right) {
          const delta = left - domRect.right;
          draggableElementDeltas[i] = delta;
          left = left - domRect.width;
        } else {
          break;
        }
      }
      return { [trackId]: draggableElementDeltas };
    }
    return null;
  }, [draggingState]);

  return (
    <draggableKeyframeDOMContext.Provider
      value={{
        registerDOM,
        draggableElementDeltas,
      }}
    >
      {children}
    </draggableKeyframeDOMContext.Provider>
  );
}

/**
 * When the user drags a keyframe,
 * the keyframe should move together with other keyframes in the same track
 * to demonstrate the `moveKeyframe()`'s effect.
 * This hook provides the delta value to move each keyframe draggable element.
 */
interface UseDraggableKeyframeDeltaReturn {
  registerDOM: DraggableKeyframeDOMContext["registerDOM"];
  delta: number | null;
}
function useDraggableKeyframeDelta(
  trackId: string,
  localIndex: number
): UseDraggableKeyframeDeltaReturn {
  const context = React.useContext(draggableKeyframeDOMContext);
  if (context == null) {
    throw new Error(
      "useDraggableKeyframeDelta must be used within a DraggableKeyframeDeltaProvider"
    );
  }

  return {
    registerDOM: context.registerDOM,
    delta: context.draggableElementDeltas?.[trackId]?.[localIndex] ?? null,
  };
}

function DraggableKeyframeUI({
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
  const { registerDOM, delta } = useDraggableKeyframeDelta(trackId, localIndex);
  const isDraggingSomething = active != null;
  const style: React.CSSProperties = {
    transform:
      delta != null
        ? `translate(${delta}px, 0)`
        : transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
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

interface KeyframeIconProps {
  localIndex: number;
  isSelected: boolean;
  onClick: () => void;
}
function KeyframeIcon(props: KeyframeIconProps) {
  return (
    <div
      className={`${styles.keyframeIcon} ${props.isSelected ? styles.selected : ""}`}
      onClick={props.onClick}
    >
      {props.localIndex + 1}
    </div>
  );
}

function DroppableArea({
  type,
  globalIndex,
  children,
  className,
}: {
  type: "at" | "after";
  globalIndex: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const droppableId = `${type}-${globalIndex}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type,
      globalIndex,
    },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.droppableCell} ${isOver ? styles.over : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

const DND_CONTEXT_MODIFIERS = [restrictToHorizontalAxis];

interface KeyframeTimelineProps<T extends JsonObject> {
  ks: Keyframe<T>[];
  onKeyframesChange: (newKs: Keyframe<T>[]) => void;
  currentFrameIndex: number;
  onFrameSelect: (frameIndex: number) => void;
  selectedKeyframeIds: Keyframe<T>["id"][];
  onKeyframeSelect: (keyframeId: string) => void;
}
export function KeyframeTimeline<T extends JsonObject>({
  ks,
  onKeyframesChange,
  currentFrameIndex,
  onFrameSelect,
  selectedKeyframeIds,
  onKeyframeSelect,
}: KeyframeTimelineProps<T>) {
  // const globalOrder = getGlobalOrder(ks);
  const { globalFrames, tracks, maxGlobalIndex } = useMemo(() => {
    const seqs = getAllLocalSequencesWithGlobalOrder(ks);
    const tracks: Track[] = seqs.map((seq) => ({
      id: `track_${seq.id}`,
    }));
    tracks.sort((a, b) => a.id.localeCompare(b.id)); // TODO: Better sorting criteria?

    let maxGlobalIndex = 0;
    const globalFrames: KeyframeUIData[][] = [];

    seqs.forEach((seq) => {
      let localIndex = 0;
      seq.sequence.forEach(({ kf, globalIndex }) => {
        if (globalIndex > maxGlobalIndex) {
          maxGlobalIndex = globalIndex;
          if (globalFrames.length < maxGlobalIndex + 1) {
            for (let i = globalFrames.length; i < maxGlobalIndex + 1; i++) {
              globalFrames[i] = [];
            }
          }
        }
        globalFrames[globalIndex] = globalFrames[globalIndex] ?? [];
        globalFrames[globalIndex].push({
          id: kf.id,
          trackId: `track_${seq.id}`,
          localIndex,
        });
        localIndex++;
      });
    });

    return { globalFrames, tracks, maxGlobalIndex };
  }, [ks]);

  const [draggingState, setDraggingState] =
    useState<KeyframeDraggingState | null>(null);

  const handleDragEnd = useCallback<NonNullable<DndContextProps["onDragEnd"]>>(
    (event) => {
      setDraggingState(null);

      const { over, active } = event;
      if (over == null) {
        // Not dropped on any droppable
        return;
      }

      const overType = over.data.current?.type;
      const overGlobalIndex = over.data.current?.globalIndex;
      if (
        typeof overGlobalIndex === "number" &&
        typeof overType === "string" &&
        (overType === "at" || overType === "after")
      ) {
        const activeId = active.id;
        // moveKeyframeでKeyframeを全体順序で移動

        const newKs = moveKeyframe(
          ks,
          activeId as KeyframeUIData["id"],
          overGlobalIndex,
          overType
        );
        onKeyframesChange(newKs);
      }
    },
    [ks, onKeyframesChange]
  );

  const handleDragMove = useCallback<
    NonNullable<DndContextProps["onDragMove"]>
  >((event) => {
    const { active, delta } = event;
    const trackId = active.data.current?.trackId;
    const localIndex = active.data.current?.localIndex;
    if (typeof trackId === "string" && typeof localIndex === "number") {
      setDraggingState({
        trackId,
        localIndex,
        delta: delta.x,
      });
    }
  }, []);

  // To capture click events on draggable elements.
  // Ref: https://github.com/clauderic/dnd-kit/issues/591
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 1,
      },
    }),
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  return (
    <DndContext
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={DND_CONTEXT_MODIFIERS}
    >
      <DraggableKeyframeDeltaProvider
        draggingState={draggingState}
        maxGlobalIndex={maxGlobalIndex}
      >
        <div className={styles.timelineContainer}>
          <div>
            {/* Header column */}
            <div className={styles.headerCell}>Frames</div>
            {tracks.map((track) => (
              <div key={track.id} className={styles.column}>
                {track.id}
              </div>
            ))}
          </div>
          <div className={styles.headerLessColumn}>
            <DroppableArea
              type="after"
              globalIndex={-1}
              className={styles.inbetweenDroppableCell}
            />
          </div>
          {globalFrames.map((globalFrame, frameIdx) => {
            return (
              <React.Fragment key={globalFrame[0].id}>
                <div className={styles.column}>
                  <div className={styles.headerCell}>
                    <button
                      className={`${styles.frameButton} ${frameIdx === currentFrameIndex ? styles.selected : ""}`}
                      onClick={() => onFrameSelect(frameIdx)}
                    >
                      {frameIdx + 1}
                    </button>
                  </div>
                  <DroppableArea
                    type="at"
                    globalIndex={frameIdx}
                    className={styles.droppableColumn}
                  >
                    {tracks.map((track) => {
                      const trackKfs = globalFrame.filter(
                        (kf) => kf.trackId === track.id
                      );
                      return (
                        <div key={track.id} className={styles.keyframeCell}>
                          {trackKfs.map((kf) => {
                            const isSelected = selectedKeyframeIds.includes(
                              kf.id
                            );
                            return (
                              <DraggableKeyframeUI
                                key={kf.id}
                                kf={kf}
                                trackId={track.id}
                                localIndex={kf.localIndex}
                              >
                                <KeyframeIcon
                                  localIndex={kf.localIndex}
                                  isSelected={isSelected}
                                  onClick={() => {
                                    onKeyframeSelect(kf.id);
                                  }}
                                />
                              </DraggableKeyframeUI>
                            );
                          })}
                        </div>
                      );
                    })}
                  </DroppableArea>
                </div>
                <div className={styles.headerLessColumn}>
                  <DroppableArea
                    type="after"
                    globalIndex={frameIdx}
                    className={styles.inbetweenDroppableCell}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </DraggableKeyframeDeltaProvider>
    </DndContext>
  );
}
