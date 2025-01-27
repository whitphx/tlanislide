import React, { useCallback, useMemo } from "react";
import {
  useDroppable,
  useDndContext,
  useSensors,
  useSensor,
  DragOverlay,
  KeyboardSensor,
  type DndContextProps,
} from "@dnd-kit/core";
import { PointerSensor, MouseSensor, TouchSensor } from "./dnd-sensors";
import { reassignGlobalIndexInplace } from "../ordered-track-item";
import type { Frame, FrameBatch, CueFrame } from "../models";
import {
  calcFrameBatchUIData,
  FrameBatchUIData,
  FrameUIData,
  SubFrameUIData,
} from "./frame-ui-data";
import { FrameMoveTogetherDndContext } from "./FrameMoveTogetherDndContext";
import { DraggableFrameUI } from "./DraggableFrameUI";
import styles from "./Timeline.module.scss";
import { FrameEditor } from "./FrameEditor/FrameEditor";

interface DragStateStyleDivProps {
  children: React.ReactNode;
  className: string;
  classNameWhenDragging: string;
}
const DragStateStyleDiv = React.forwardRef<
  HTMLDivElement,
  DragStateStyleDivProps
>((props, ref) => {
  const { active } = useDndContext();
  return (
    <div
      ref={ref}
      className={active != null ? props.classNameWhenDragging : props.className}
    >
      {props.children}
    </div>
  );
});

function FrameDragOverlay() {
  const { active } = useDndContext();
  const draggedFrame = active?.data.current?.frame as Frame | undefined;

  return (
    draggedFrame != null && (
      <DragOverlay>
        <FrameEditor
          frame={draggedFrame}
          onUpdate={() => {}}
          isSelected={false}
          onClick={() => {}}
        />
      </DragOverlay>
    )
  );
}

interface FrameIconProps {
  isSelected?: boolean;
  subFrame?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
  as?: React.ElementType;
}
const FrameIcon = React.forwardRef<HTMLElement, FrameIconProps>(
  (props, ref) => {
    return React.createElement(props.as ?? "div", {
      ref,
      className: `${styles.frameIcon} ${props.isSelected ? styles.selected : ""} ${props.subFrame ? styles.subFrame : ""}`,
      onClick: props.onClick,
      children: props.children,
    });
  },
);

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

interface TimelineProps {
  frameBatches: FrameBatch[];
  onFrameChange: (newFrame: Frame) => void;
  onFrameBatchesChange: (newFrameBatches: FrameBatch[]) => void;
  currentStepIndex: number;
  onStepSelect: (stepIndex: number) => void;
  selectedFrameIds: Frame["id"][];
  onFrameSelect: (cueFrameId: string) => void;
  requestCueFrameAddAfter: (prevCueFrame: CueFrame) => void;
  requestSubFrameAddAfter: (prevFrame: Frame) => void;
  showAttachCueFrameButton: boolean;
  requestAttachCueFrame: () => void;
}
export function Timeline({
  frameBatches,
  onFrameChange,
  onFrameBatchesChange,
  currentStepIndex,
  onStepSelect,
  selectedFrameIds,
  onFrameSelect,
  requestCueFrameAddAfter,
  requestSubFrameAddAfter,
  showAttachCueFrameButton,
  requestAttachCueFrame,
}: TimelineProps) {
  const { steps, tracks } = useMemo(
    () => calcFrameBatchUIData(frameBatches),
    [frameBatches],
  );

  const handleDragEnd = useCallback<NonNullable<DndContextProps["onDragEnd"]>>(
    (event) => {
      const { over, active } = event;
      if (over == null) {
        // Not dropped on any droppable
        return;
      }

      const trackId = active.data.current?.trackId;
      const srcTrackIndex = active.data.current?.trackIndex;
      const srcGlobalIndex = active.data.current?.globalIndex;
      const dstType = over.data.current?.type;
      let dstGlobalIndex = over.data.current?.globalIndex;
      if (
        !(
          typeof trackId === "string" &&
          typeof srcTrackIndex === "number" &&
          typeof srcGlobalIndex === "number" &&
          typeof dstGlobalIndex === "number" &&
          typeof dstType === "string" &&
          (dstType === "at" || dstType === "after")
        )
      ) {
        return;
      }

      const track = tracks.find((track) => track.id === trackId);
      if (track == null) {
        return;
      }

      if (
        srcGlobalIndex < dstGlobalIndex ||
        (srcGlobalIndex === dstGlobalIndex && dstType === "after")
      ) {
        if (dstType === "after") {
          dstGlobalIndex++;
        }
        // Move to the right
        const newSteps: FrameBatch[][] = [];
        const pushedOutFrames: FrameUIData[] = [];
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
          const step = steps[stepIndex];
          if (stepIndex < srcGlobalIndex) {
            newSteps.push(step);
          } else if (stepIndex === srcGlobalIndex) {
            const newStep: FrameBatch[] = [];
            step.forEach((frameBatch) => {
              if (frameBatch.trackId !== track.id) {
                newStep.push(frameBatch);
              } else {
                const [cueFrame, ...subFrames] = frameBatch.data;
                if (cueFrame.trackIndex === srcTrackIndex) {
                  pushedOutFrames.push(cueFrame, ...subFrames);
                } else {
                  const remainingSubFrames: SubFrameUIData[] = [];
                  subFrames.forEach((subFrame) => {
                    if (subFrame.trackIndex < srcTrackIndex) {
                      remainingSubFrames.push(subFrame);
                    } else {
                      pushedOutFrames.push(subFrame);
                    }
                  });
                  newStep.push({
                    ...frameBatch,
                    data: [cueFrame, ...remainingSubFrames],
                  });
                }
              }
            });
            newSteps.push(newStep);
          } else if (srcGlobalIndex < stepIndex && stepIndex < dstGlobalIndex) {
            const newStep: FrameBatch[] = [];
            step.forEach((frameBatch) => {
              if (frameBatch.trackId !== track.id) {
                newStep.push(frameBatch);
              } else {
                pushedOutFrames.push(...frameBatch.data);
              }
            });
            newSteps.push(newStep);
          } else if (stepIndex === dstGlobalIndex) {
            const newStep: FrameBatch[] = [];
            let existingDstFrameBatch: FrameBatchUIData | null = null;
            for (const frameBatch of step) {
              if (!(dstType === "at" && frameBatch.trackId === track.id)) {
                newStep.push(frameBatch);
              } else {
                existingDstFrameBatch = frameBatch;
              }
            }

            if (existingDstFrameBatch != null) {
              const lastPushedOutFrame = pushedOutFrames.at(-1);
              if (lastPushedOutFrame != null) {
                const [cueFrame, ...subFrames] = existingDstFrameBatch.data;
                pushedOutFrames.push(
                  {
                    id: cueFrame.id,
                    type: "sub",
                    prevFrameId: lastPushedOutFrame.id,
                    trackIndex: cueFrame.trackIndex,
                    action: cueFrame.action,
                  },
                  ...subFrames,
                );
              } else {
                pushedOutFrames.push(...existingDstFrameBatch.data);
              }
            }
            // Convert the pushed out frames into new frame batches
            let frameBatchesToInsert: FrameBatch[] = [];
            if (pushedOutFrames.length > 0) {
              pushedOutFrames[0] = {
                // The first frame is always a cueFrame
                ...pushedOutFrames[0],
                type: "cue",
                trackId: track.id,
                globalIndex: 999999, // This will be set later.
              };
              pushedOutFrames.forEach((frame) => {
                if (frame.type === "cue") {
                  frameBatchesToInsert.push({
                    id: `batch-${pushedOutFrames[0].id}`,
                    trackId: track.id,
                    globalIndex: 999999, // This will be set later.
                    data: [frame],
                  });
                } else {
                  frameBatchesToInsert.at(-1)?.data.push(frame);
                }
              });
            }

            if (dstType === "at") {
              const lastFrameBatchToInsert = frameBatchesToInsert.at(-1);
              if (lastFrameBatchToInsert != null) {
                newStep.push(lastFrameBatchToInsert);
                frameBatchesToInsert = frameBatchesToInsert.slice(0, -1);
              }
            }

            frameBatchesToInsert.forEach((frameBatchToInsert) => {
              newSteps.push([frameBatchToInsert]);
            });
            newSteps.push(newStep);
          } else if (dstGlobalIndex < stepIndex) {
            newSteps.push(step);
          }
        }
        reassignGlobalIndexInplace(newSteps);
        for (const step of newSteps) {
          for (const frameBatch of step) {
            frameBatch.data[0].globalIndex = frameBatch.globalIndex;
          }
        }
        onFrameBatchesChange(newSteps.flat());
      } else if (
        dstGlobalIndex < srcGlobalIndex ||
        (dstGlobalIndex === srcGlobalIndex && dstType === "after")
      ) {
        // Move to the left
        const newSteps: FrameBatch[][] = [];
        const pushedOutFrames: Frame[] = [];
        for (let stepIndex = steps.length - 1; stepIndex >= -1; stepIndex--) {
          // NOTE: Loop until `stepIndex` is -1 to handle the case where `dstGlobalIndex = -1` and `dstType = "after"`.
          const step = steps[stepIndex] ?? [];
          if (srcGlobalIndex < stepIndex) {
            newSteps.unshift(step);
          } else if (stepIndex === srcGlobalIndex) {
            const newStep: FrameBatch[] = [];
            for (const frameBatch of step) {
              if (frameBatch.trackId !== track.id) {
                newStep.push(frameBatch);
              } else {
                const lastFrame = frameBatch.data.at(-1);
                if (lastFrame && lastFrame.trackIndex === srcTrackIndex) {
                  pushedOutFrames.unshift(...frameBatch.data);
                } else {
                  const [cueFrame, ...subFrames] = frameBatch.data;
                  const remainingSubFrames: SubFrameUIData[] = [];
                  subFrames.reverse().forEach((subFrame) => {
                    if (srcTrackIndex < subFrame.trackIndex) {
                      remainingSubFrames.unshift(subFrame);
                    } else {
                      pushedOutFrames.unshift(subFrame);
                    }
                  });
                  pushedOutFrames.unshift(cueFrame);
                  const [firstRemainingSubFrame, ...restRemainingSubFrames] =
                    remainingSubFrames;
                  newStep.push({
                    ...frameBatch,
                    data: [
                      {
                        id: firstRemainingSubFrame.id,
                        type: "cue",
                        globalIndex: 999999, // This will be set later
                        trackId: track.id,
                        action: firstRemainingSubFrame.action,
                      },
                      ...restRemainingSubFrames,
                    ],
                  });
                }
              }
            }
            newSteps.unshift(newStep);
          } else if (dstGlobalIndex < stepIndex && stepIndex < srcGlobalIndex) {
            const newStep: FrameBatch[] = [];
            for (const frameBatch of step) {
              if (frameBatch.trackId !== track.id) {
                newStep.push(frameBatch);
              } else {
                pushedOutFrames.unshift(...frameBatch.data);
              }
            }
            newSteps.unshift(newStep);
          } else if (stepIndex === dstGlobalIndex) {
            const newStep: FrameBatch[] = [];
            let existingDstFrameBatch: FrameBatchUIData | null = null;
            for (const frameBatch of step) {
              if (!(dstType === "at" && frameBatch.trackId === track.id)) {
                newStep.push(frameBatch);
              } else {
                existingDstFrameBatch = frameBatch;
              }
            }

            if (existingDstFrameBatch != null) {
              if (pushedOutFrames.length > 0) {
                // Merge the existing frame batch with the pushed out frames
                const [firstPushedOutFrame, ...restPushedOutFrames] =
                  pushedOutFrames;
                pushedOutFrames.unshift(
                  ...existingDstFrameBatch.data,
                  {
                    id: firstPushedOutFrame.id,
                    type: "sub",
                    prevFrameId: existingDstFrameBatch.data.at(-1)!.id,
                    action: firstPushedOutFrame.action,
                  },
                  ...restPushedOutFrames,
                );
              } else {
                pushedOutFrames.unshift(...existingDstFrameBatch.data);
              }
            }

            // Convert the pushed out frames into new frame batches
            const frameBatchesToInsert: FrameBatch[] = [];
            if (pushedOutFrames.length > 0) {
              pushedOutFrames[0] = {
                // The first frame is always a cueFrame
                ...pushedOutFrames[0],
                type: "cue",
                trackId: track.id,
                globalIndex: 999999, // This will be set later.
              };
              pushedOutFrames.forEach((frame) => {
                if (frame.type === "cue") {
                  frameBatchesToInsert.push({
                    id: `batch-${pushedOutFrames[0].id}`,
                    trackId: track.id,
                    globalIndex: 999999, // This will be set later.
                    data: [frame],
                  });
                } else {
                  frameBatchesToInsert.at(-1)?.data.push(frame);
                }
              });
            }

            const [firstFrameBatchToInsert, ...restFrameBatchesToInsert] =
              frameBatchesToInsert;
            restFrameBatchesToInsert.reverse().forEach((frameBatch) => {
              newSteps.unshift([frameBatch]);
            });

            if (dstType === "at") {
              newStep.push(firstFrameBatchToInsert);
            } else {
              newSteps.unshift([firstFrameBatchToInsert]);
            }
            newSteps.unshift(newStep);
          } else if (stepIndex < dstGlobalIndex) {
            newSteps.unshift(step);
          }
        }

        reassignGlobalIndexInplace(newSteps);
        for (const step of newSteps) {
          for (const frameBatch of step) {
            frameBatch.data[0].globalIndex = frameBatch.globalIndex;
          }
        }
        onFrameBatchesChange(newSteps.flat());
      }
    },
    [steps, tracks, onFrameBatchesChange],
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
    useSensor(KeyboardSensor),
  );

  return (
    <FrameMoveTogetherDndContext onDragEnd={handleDragEnd} sensors={sensors}>
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
        {steps.map((stepFrameBatches, stepIdx) => {
          const isActive = stepIdx === currentStepIndex;
          return (
            <React.Fragment key={stepFrameBatches[0].id}>
              <div
                className={`${styles.column} ${isActive ? styles.active : ""}`}
              >
                <div className={styles.headerCell}>
                  <button
                    className={`${styles.frameButton} ${stepIdx === currentStepIndex ? styles.selected : ""}`}
                    onClick={() => onStepSelect(stepIdx)}
                  >
                    {stepIdx + 1}
                  </button>
                </div>
                <DroppableArea
                  type="at"
                  globalIndex={stepIdx}
                  className={styles.droppableColumn}
                >
                  {tracks.map((track) => {
                    const trackFrameBatches = stepFrameBatches.filter(
                      // `trackFrameBatches.length` should always be 1, but we loop over it just in case.
                      (b) => b.trackId === track.id,
                    );
                    return (
                      <div key={track.id} className={styles.frameBatchCell}>
                        {trackFrameBatches.map((trackFrameBatch) => {
                          const frames = trackFrameBatch.data;

                          const [cueFrame, ...subFrames] = frames;
                          return (
                            <div
                              key={trackFrameBatch.id}
                              className={styles.frameBatchControl}
                            >
                              <DraggableFrameUI
                                id={trackFrameBatch.id}
                                trackId={track.id}
                                trackIndex={cueFrame.trackIndex}
                                globalIndex={trackFrameBatch.globalIndex}
                                frame={cueFrame}
                              >
                                <FrameEditor
                                  frame={cueFrame}
                                  onUpdate={(newCueFrame) =>
                                    onFrameChange(newCueFrame)
                                  }
                                  isSelected={selectedFrameIds.includes(
                                    cueFrame.id,
                                  )}
                                  onClick={() => {
                                    onFrameSelect(cueFrame.id);
                                  }}
                                />
                              </DraggableFrameUI>

                              {subFrames.map((subFrame) => {
                                return (
                                  <DraggableFrameUI
                                    key={subFrame.id}
                                    id={subFrame.id}
                                    trackId={track.id}
                                    trackIndex={subFrame.trackIndex}
                                    globalIndex={trackFrameBatch.globalIndex}
                                    frame={subFrame}
                                  >
                                    <FrameEditor
                                      frame={subFrame}
                                      onUpdate={(newFrame) =>
                                        onFrameChange(newFrame)
                                      }
                                      isSelected={selectedFrameIds.includes(
                                        subFrame.id,
                                      )}
                                      onClick={() => {
                                        onFrameSelect(subFrame.id);
                                      }}
                                    />
                                  </DraggableFrameUI>
                                );
                              })}
                              <div className={styles.frameAddButtonContainer}>
                                <FrameIcon
                                  as="button"
                                  subFrame
                                  onClick={() =>
                                    requestSubFrameAddAfter(frames.at(-1)!)
                                  }
                                >
                                  +
                                </FrameIcon>
                                <div className={styles.hoverExpandedPart}>
                                  <FrameIcon
                                    as="button"
                                    onClick={() =>
                                      requestCueFrameAddAfter(cueFrame)
                                    }
                                  >
                                    +
                                  </FrameIcon>
                                </div>
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
                  globalIndex={stepIdx}
                  className={styles.inbetweenDroppableCell}
                />
              </div>
            </React.Fragment>
          );
        })}
        {showAttachCueFrameButton && (
          <div className={styles.column}>
            <div className={styles.headerCell}>{steps.length + 1}</div>
            {tracks.map((track) => (
              <div key={track.id} className={styles.frameBatchCell}></div>
            ))}
            <div className={styles.frameBatchCell}>
              <FrameIcon
                as="button"
                isSelected={true}
                onClick={() => requestAttachCueFrame()}
              >
                +
              </FrameIcon>
            </div>
          </div>
        )}
      </DragStateStyleDiv>
      <FrameDragOverlay />
    </FrameMoveTogetherDndContext>
  );
}
