// KeyframeTimeline.tsx

import React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  Keyframe,
  getAllLocalSequencesWithGlobalOrder,
  moveKeyframe,
} from "./keyframe";
import { JsonObject } from "tldraw";

interface MyData extends JsonObject {
  // Keyframeごとのデータ（必要なら他属性）
}

interface KeyframeData {
  id: string;
  trackId: string;
  globalIndex: number;
}

interface Track {
  id: string;
}

interface KeyframeTimelineProps {
  ks: Keyframe<MyData>[];
  onKeyframesChange: (newKs: Keyframe<MyData>[]) => void;
}

function generateUIData(ks: Keyframe<MyData>[]): {
  keyframes: KeyframeData[];
  tracks: Track[];
  maxGlobalIndex: number;
} {
  const seqs = getAllLocalSequencesWithGlobalOrder(ks);
  const tracks: Track[] = seqs.map((_, i) => ({ id: `track_${i}` }));
  let maxGlobalIndex = 0;
  const keyframes: KeyframeData[] = [];

  seqs.forEach((seq, seqIndex) => {
    seq.sequence.forEach(({ kf, globalIndex }) => {
      if (globalIndex > maxGlobalIndex) maxGlobalIndex = globalIndex;
      keyframes.push({
        id: kf.id,
        trackId: `track_${seqIndex}`,
        globalIndex: globalIndex,
      });
    });
  });

  return { keyframes, tracks, maxGlobalIndex };
}

function DraggableKeyframeUI({ kf }: { kf: KeyframeData }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: kf.id,
    data: kf,
  });
  const style: React.CSSProperties = {
    display: "inline-block",
    padding: "4px",
    margin: "2px",
    background: "#ffc",
    border: "1px solid #cc9",
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    cursor: "grab",
  };
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style}>
      ★
    </div>
  );
}

function DroppableCell({
  trackId,
  globalIndex,
  children,
}: {
  trackId: string;
  globalIndex: number;
  children?: React.ReactNode;
}) {
  const droppableId = `${trackId}-frame-${globalIndex}`;
  const { setNodeRef } = useDroppable({
    id: droppableId,
    data: { globalIndex },
  });
  const style: React.CSSProperties = {
    minWidth: "50px",
    minHeight: "50px",
    border: "1px dashed #ccc",
    position: "relative",
    verticalAlign: "top",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}

export function KeyframeTimeline({
  ks,
  onKeyframesChange,
}: KeyframeTimelineProps) {
  const { keyframes, tracks, maxGlobalIndex } = generateUIData(ks);
  const frameNumbers = Array.from({ length: maxGlobalIndex + 1 }, (_, i) => i);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    if (over) {
      const overGlobalIndex = over.data.current?.globalIndex;
      if (typeof overGlobalIndex === "number") {
        const activeId = active.id;
        // moveKeyframeでKeyframeを全体順序で移動
        // moveKeyframe(ks, activeId, newGlobalIndex) というようなシグネチャだったと仮定
        // 以前の実装を思い出すと、moveKeyframeは (ks: Keyframe<T>[], targetId: string, newIndex: number) -> Keyframe<T>[] のような形だったはず
        const newKs = moveKeyframe(
          ks,
          activeId as KeyframeData["id"],
          overGlobalIndex
        );
        onKeyframesChange(newKs);
      }
    } else {
      // overがnullの場合、ドロップがdroppable上で終わらなかったことを意味する
      // 特に処理が必要なければ何もしない
    }
  };

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      modifiers={[restrictToHorizontalAxis]}
    >
      <div
        style={{
          display: "inline-block",
          border: "1px solid #000",
          padding: "8px",
        }}
      >
        {/* Frames行 */}
        <div style={{ display: "flex" }}>
          <div style={{ width: "80px" }}>Frames</div>
          {frameNumbers.map((i) => (
            <div
              key={i}
              style={{
                width: "50px",
                textAlign: "center",
                borderRight: "1px solid #999",
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Tracks行 */}
        {tracks.map((track) => {
          const trackKfs = keyframes.filter((kf) => kf.trackId === track.id);
          return (
            <div style={{ display: "flex" }} key={track.id}>
              <div style={{ width: "80px", borderRight: "1px solid #999" }}>
                {track.id}
              </div>
              {frameNumbers.map((i) => {
                const kfsAtFrame = trackKfs.filter((k) => k.globalIndex === i);
                return (
                  <DroppableCell trackId={track.id} globalIndex={i} key={i}>
                    {kfsAtFrame.map((kf, idx) => (
                      <div
                        key={kf.id}
                        style={{ position: "absolute", top: idx * 20, left: 0 }}
                      >
                        <DraggableKeyframeUI kf={kf} />
                      </div>
                    ))}
                  </DroppableCell>
                );
              })}
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
