import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  useDndContext,
  useSensors,
  useSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DndContextProps,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  Keyframe,
  getAllLocalSequencesWithGlobalOrder,
  moveKeyframe,
} from "./keyframe";
import {
  EASINGS,
  TldrawUiPopover,
  TldrawUiPopoverTrigger,
  TldrawUiPopoverContent,
} from "tldraw";
import type { JsonObject } from "tldraw";
import type { KeyframeData } from "./models";
import styles from "./KeyframeTimeline.module.scss";

const EASINGS_OPTIONS = Object.keys(EASINGS);
function isEasingOption(value: string): value is keyof typeof EASINGS {
  return EASINGS_OPTIONS.includes(value);
}

interface KeyframeUIData {
  id: string;
  trackId: string;
  localIndex: number;
  keyframe: Keyframe<JsonObject>;
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

function KeyframeMoveTogetherDndContext({
  children,
  maxGlobalIndex,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  ...dndContextProps
}: {
  children: React.ReactNode;
  maxGlobalIndex: number;
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
          delta: delta.x,
        });
      }

      onDragMove?.(event);
    },
    [onDragMove]
  );

  const handleDragEnd = useCallback<NonNullable<DndContextProps["onDragEnd"]>>(
    (event) => {
      setDraggingState(null);
      onDragEnd?.(event);
    },
    [onDragEnd]
  );
  const handleDragCancel = useCallback<
    NonNullable<DndContextProps["onDragCancel"]>
  >(
    (event) => {
      setDraggingState(null);
      onDragCancel?.(event);
    },
    [onDragCancel]
  );

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

  const draggableDOMOrgRectsRef = useRef<Record<string, (DOMRect | null)[]>>(
    {}
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
    [initializeDOMRects, onDragStart]
  );

  const draggableElementDeltas = useMemo(() => {
    if (draggingState == null) {
      return null;
    }
    const { trackId, localIndex, delta } = draggingState;

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
      const draggableElementDeltas: Record<number, number> = {};
      // Dragging right
      let right = selfRect.right + delta;
      for (let i = localIndex + 1; i < rectsInTrack.length; i++) {
        const domRect = rectsInTrack[i];
        if (domRect == null) continue;
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
        const domRect = rectsInTrack[i];
        if (domRect == null) continue;
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

interface KeyframeEditPopoverProps {
  keyframe: Keyframe<KeyframeData>;
  onUpdate: (newKf: Keyframe<KeyframeData>) => void;
  children: React.ReactNode;
}
function KeyframeEditPopover({
  keyframe,
  onUpdate,
  children,
}: KeyframeEditPopoverProps) {
  return (
    <TldrawUiPopover id={`keyframe-config-${keyframe.id}`}>
      <TldrawUiPopoverTrigger>{children}</TldrawUiPopoverTrigger>
      <TldrawUiPopoverContent side="bottom" sideOffset={6}>
        <div className={styles.popoverContent}>
          <div>
            <label>
              Duration
              <input
                type="number"
                value={keyframe.data.duration ?? 0}
                onChange={(e) => {
                  onUpdate({
                    ...keyframe,
                    data: {
                      ...keyframe.data,
                      duration: parseInt(e.target.value),
                    },
                  });
                }}
              />
            </label>
            <input
              type="range"
              min={0}
              max={Math.max(10000, keyframe.data.duration ?? 0)}
              value={keyframe.data.duration ?? 0}
              onChange={(e) => {
                onUpdate({
                  ...keyframe,
                  data: {
                    ...keyframe.data,
                    duration: parseInt(e.target.value),
                  },
                });
              }}
            />
          </div>
          <div>
            <label>
              Easing
              <select
                value={keyframe.data.easing ?? ""}
                onChange={(e) => {
                  if (isEasingOption(e.target.value)) {
                    onUpdate({
                      ...keyframe,
                      data: {
                        ...keyframe.data,
                        easing: e.target.value,
                      },
                    });
                  }
                }}
              >
                <option value=""></option>
                {EASINGS_OPTIONS.map((easing) => (
                  <option key={easing} value={easing}>
                    {easing}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </TldrawUiPopoverContent>
    </TldrawUiPopover>
  );
}

interface DragStateStyleDivProps {
  children: React.ReactNode;
  className: string;
  classNameWhenDragging: string;
}
function DragStateStyleDiv(props: DragStateStyleDivProps) {
  const { active } = useDndContext();
  return (
    <div
      className={active != null ? props.classNameWhenDragging : props.className}
    >
      {props.children}
    </div>
  );
}

interface KeyframeIconProps {
  isSelected?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
  as?: React.ElementType;
}
function KeyframeIcon(props: KeyframeIconProps) {
  return React.createElement(props.as ?? "div", {
    className: `${styles.keyframeIcon} ${props.isSelected ? styles.selected : ""}`,
    onClick: props.onClick,
    children: props.children,
  });
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

interface KeyframeTimelineProps {
  ks: Keyframe<KeyframeData>[];
  onKeyframesChange: (newKs: Keyframe<KeyframeData>[]) => void;
  currentFrameIndex: number;
  onFrameSelect: (frameIndex: number) => void;
  selectedKeyframeIds: Keyframe<KeyframeData>["id"][];
  onKeyframeSelect: (keyframeId: string) => void;
  requestKeyframeAddAfter: (prevKeyframe: Keyframe<KeyframeData>) => void;
  showAttachKeyframeButton: boolean;
  requestAttachKeyframe: () => void;
}
export function KeyframeTimeline({
  ks,
  onKeyframesChange,
  currentFrameIndex,
  onFrameSelect,
  selectedKeyframeIds,
  onKeyframeSelect,
  requestKeyframeAddAfter,
  showAttachKeyframeButton,
  requestAttachKeyframe,
}: KeyframeTimelineProps) {
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
          keyframe: kf,
        });
        localIndex++;
      });
    });

    return { globalFrames, tracks, maxGlobalIndex };
  }, [ks]);

  const handleDragEnd = useCallback<NonNullable<DndContextProps["onDragEnd"]>>(
    (event) => {
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
    <KeyframeMoveTogetherDndContext
      maxGlobalIndex={maxGlobalIndex}
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={DND_CONTEXT_MODIFIERS}
    >
      <DragStateStyleDiv
        className={styles.timelineContainer}
        classNameWhenDragging={`${styles.timelineContainer} ${styles.dragging}`}
      >
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
                            <div key={kf.id} className={styles.keyframeControl}>
                              <KeyframeEditPopover
                                keyframe={kf.keyframe}
                                onUpdate={(newKeyframe) => {
                                  onKeyframesChange(
                                    ks.map((kf) =>
                                      kf.id === newKeyframe.id
                                        ? newKeyframe
                                        : kf
                                    )
                                  );
                                }}
                              >
                                <div>
                                  <DraggableKeyframeUI
                                    kf={kf}
                                    trackId={track.id}
                                    localIndex={kf.localIndex}
                                  >
                                    <KeyframeIcon
                                      isSelected={isSelected}
                                      onClick={() => {
                                        onKeyframeSelect(kf.id);
                                      }}
                                    >
                                      {kf.localIndex + 1}
                                    </KeyframeIcon>
                                  </DraggableKeyframeUI>
                                </div>
                              </KeyframeEditPopover>
                              <div className={styles.frameAddButtonContainer}>
                                <KeyframeIcon
                                  as="button"
                                  onClick={() =>
                                    requestKeyframeAddAfter(kf.keyframe)
                                  }
                                >
                                  +
                                </KeyframeIcon>
                              </div>
                            </div>
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
        {showAttachKeyframeButton && (
          <div className={styles.column}>
            <div className={styles.headerCell}>{globalFrames.length + 1}</div>
            {tracks.map((track) => (
              <div key={track.id} className={styles.keyframeCell}></div>
            ))}
            <div className={styles.keyframeCell}>
              <KeyframeIcon
                as="button"
                isSelected={true}
                onClick={() => requestAttachKeyframe()}
              >
                +
              </KeyframeIcon>
            </div>
          </div>
        )}
      </DragStateStyleDiv>
    </KeyframeMoveTogetherDndContext>
  );
}
