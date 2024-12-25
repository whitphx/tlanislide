import React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  useSensors,
  DragEndEvent,
  useSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  Keyframe,
  getAllLocalSequencesWithGlobalOrder,
  moveKeyframe,
} from "./keyframe";
import type { JsonObject } from "tldraw";

interface KeyframeUIData {
  id: string;
  trackId: string;
  globalIndex: number;
}

interface Track {
  id: string;
}

function generateUIData<T extends JsonObject>(
  ks: Keyframe<T>[]
): {
  keyframes: KeyframeUIData[];
  tracks: Track[];
  maxGlobalIndex: number;
} {
  const seqs = getAllLocalSequencesWithGlobalOrder(ks);
  const tracks: Track[] = seqs.map((seq) => ({
    id: `track_${seq.id}`,
  }));
  tracks.sort((a, b) => a.id.localeCompare(b.id)); // TODO: Better sorting criteria?

  let maxGlobalIndex = 0;
  const keyframes: KeyframeUIData[] = [];

  seqs.forEach((seq) => {
    seq.sequence.forEach(({ kf, globalIndex }) => {
      if (globalIndex > maxGlobalIndex) maxGlobalIndex = globalIndex;
      keyframes.push({
        id: kf.id,
        trackId: `track_${seq.id}`,
        globalIndex: globalIndex,
      });
    });
  });

  return { keyframes, tracks, maxGlobalIndex };
}

function DraggableKeyframeUI({
  kf,
  children,
  onClick,
  isSelected,
}: {
  kf: KeyframeUIData;
  children: React.ReactNode;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: kf.id,
  });
  const style: React.CSSProperties = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    cursor: "grab",
    // Circle shape
    display: "inline-block",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    textAlign: "center",
    background: isSelected ? "#faa" : "#ddd",
  };
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      {...attributes}
      {...listeners}
      style={style}
    >
      {children}
    </div>
  );
}

function DroppableCell({
  trackId,
  globalIndex,
  children,
  style,
}: {
  trackId: string;
  globalIndex: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const droppableId = `${trackId}-frame-${globalIndex}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { globalIndex },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isOver ? "#eee" : undefined,
      }}
    >
      {children}
    </div>
  );
}

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
  const { keyframes, tracks, maxGlobalIndex } = generateUIData(ks);
  const frameNumbers = Array.from({ length: maxGlobalIndex + 1 }, (_, i) => i);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (over == null) {
      // Not dropped on any droppable
      return;
    }

    const overGlobalIndex = over.data.current?.globalIndex;
    if (typeof overGlobalIndex === "number") {
      const activeId = active.id;
      // moveKeyframeでKeyframeを全体順序で移動
      const newKs = moveKeyframe(
        ks,
        activeId as KeyframeUIData["id"],
        overGlobalIndex
      );
      onKeyframesChange(newKs);
    }
  };

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
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={[restrictToHorizontalAxis]}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto", // Track title column's width
          gridAutoColumns: "minmax(50px, auto-fill)", // Frame column's width
          gridTemplateRows: "auto", // Title row's height
          gridAutoRows: "50px", // Track row's height
        }}
      >
        {/* Frames行 */}
        <div
          style={{
            gridRow: 1,
            gridColumn: 1,
          }}
        >
          Frames
        </div>
        {frameNumbers.map((frameIdx) => (
          <div
            key={frameIdx}
            style={{
              gridRow: 1,
              gridColumn: frameIdx + 2,
            }}
          >
            <button
              style={{
                width: "100%",
                fontWeight: frameIdx === currentFrameIndex ? "bold" : "normal",
              }}
              onClick={() => onFrameSelect(frameIdx)}
            >
              {frameIdx + 1}
            </button>
          </div>
        ))}

        {/* Tracks行 */}
        {tracks.map((track, trackIdx) => {
          const trackKfs = keyframes.filter((kf) => kf.trackId === track.id);
          let frameCount = 0;
          return (
            <React.Fragment key={track.id}>
              <div
                style={{
                  gridRow: trackIdx + 2,
                  gridColumn: 1,
                }}
              >
                {/* Track title column */}
                {track.id}
              </div>
              {frameNumbers.map((frameIdx) => {
                const kfsAtFrame = trackKfs.filter(
                  (k) => k.globalIndex === frameIdx
                );
                if (kfsAtFrame.length > 0) {
                  frameCount++;
                }
                return (
                  <DroppableCell
                    key={frameIdx}
                    trackId={track.id}
                    globalIndex={frameIdx}
                    style={{
                      gridRow: trackIdx + 2,
                      gridColumn: frameIdx + 2,
                    }}
                  >
                    {kfsAtFrame.map((kf) => {
                      const isSelected = selectedKeyframeIds.includes(kf.id);
                      return (
                        <DraggableKeyframeUI
                          key={kf.id}
                          kf={kf}
                          onClick={() => {
                            onKeyframeSelect(kf.id);
                          }}
                          isSelected={isSelected}
                        >
                          {frameCount}
                        </DraggableKeyframeUI>
                      );
                    })}
                  </DroppableCell>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </DndContext>
  );
}
