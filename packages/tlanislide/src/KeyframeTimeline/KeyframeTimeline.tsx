import React, { useCallback, useMemo } from "react";
import {
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
import { Keyframe, moveKeyframePreservingLocalOrder } from "../keyframe";
import {
  EASINGS,
  TldrawUiPopover,
  TldrawUiPopoverTrigger,
  TldrawUiPopoverContent,
} from "tldraw";
import type { KeyframeData } from "../models";
import { calcKeyframeUIData, type KeyframeUIData } from "./keyframe-ui-data";
import { useAnimatedActiveColumnIndicator } from "./useAnimatedActiveColumnIndicator";
import { KeyframeMoveTogetherDndContext } from "./KeyframeMoveTogetherDndContext";
import { DraggableKeyframeUI } from "./DraggableKeyframeUI";
import styles from "./KeyframeTimeline.module.scss";

const EASINGS_OPTIONS = Object.keys(EASINGS);
function isEasingOption(value: string): value is keyof typeof EASINGS {
  return EASINGS_OPTIONS.includes(value);
}

interface NumberFieldProps {
  label: string;
  value: number;
  max: number;
  onChange: (newValue: number) => void;
}
function NumberField({ label, value, max, onChange }: NumberFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === "") {
        onChange(0);
        return;
      }
      const intVal = parseInt(e.target.value);
      if (!isNaN(intVal)) {
        onChange(intVal);
      }
    },
    [onChange]
  );
  return (
    <div>
      <label>
        {label}
        <input type="number" value={value} onChange={handleChange} />
      </label>
      <input
        type="range"
        min={0}
        max={Math.max(max, value)}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
}

function SelectField<T extends string[]>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: T;
  onChange: (newValue: T[number]) => void;
}) {
  return (
    <div>
      <label>
        {label}
        <select
          value={value}
          onChange={(e) => {
            if (options.includes(e.target.value)) {
              onChange(e.target.value);
            }
          }}
        >
          <option value=""></option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
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
          {keyframe.data.type === "cameraZoom" && (
            <NumberField
              label="Inset"
              value={keyframe.data.inset ?? 0}
              max={1000}
              onChange={(newInset) =>
                onUpdate({
                  ...keyframe,
                  data: {
                    ...keyframe.data,
                    inset: newInset,
                  },
                })
              }
            />
          )}
          <NumberField
            label="Duration"
            value={keyframe.data.duration ?? 0}
            max={10000}
            onChange={(newDuration) =>
              onUpdate({
                ...keyframe,
                data: {
                  ...keyframe.data,
                  duration: newDuration,
                },
              })
            }
          />
          <SelectField
            label="Easing"
            value={keyframe.data.easing ?? ""}
            options={EASINGS_OPTIONS}
            onChange={(newEasing) => {
              if (isEasingOption(newEasing)) {
                onUpdate({
                  ...keyframe,
                  data: {
                    ...keyframe.data,
                    easing: newEasing,
                  },
                });
              }
            }}
          />
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
  const { globalFrames, tracks } = useMemo(() => calcKeyframeUIData(ks), [ks]);

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

        const newKs = moveKeyframePreservingLocalOrder(
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

  const { containerRef, setColumnRef, columnIndicatorRef } =
    useAnimatedActiveColumnIndicator(currentFrameIndex);

  return (
    <KeyframeMoveTogetherDndContext
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={DND_CONTEXT_MODIFIERS}
    >
      <DragStateStyleDiv
        ref={containerRef}
        className={styles.timelineContainer}
        classNameWhenDragging={`${styles.timelineContainer} ${styles.dragging}`}
      >
        <div
          ref={columnIndicatorRef}
          className={styles.activeColumnIndicator}
        />
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
              <div className={styles.column} ref={setColumnRef(frameIdx)}>
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
                                keyframe={kf}
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
                                      {kf.data.type === "cameraZoom"
                                        ? "🎞️"
                                        : kf.localIndex + 1}
                                    </KeyframeIcon>
                                  </DraggableKeyframeUI>
                                </div>
                              </KeyframeEditPopover>
                              <div className={styles.frameAddButtonContainer}>
                                <KeyframeIcon
                                  as="button"
                                  onClick={() => requestKeyframeAddAfter(kf)}
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
