import { track, useEditor, stopEventPropagation } from "tldraw";
import {
  $currentFrameIndex,
  $presentationMode,
  getAnimeMeta,
  runInitialFrame,
} from "./frame";
import { $presentationFlow, runFrame } from "./frame";
import { SlideShapeType } from "./SlideShapeUtil";
import {
  CAMERA_SEQUENCE_ID,
  SequenceId,
  ShapeSequenceId,
} from "./presentation-flow";

interface FrameColumnProps {
  columnIndex: number;
  shapeSequenceIds: ShapeSequenceId[];
  stepContents: Record<
    SequenceId,
    { text: string; isSelected: boolean } | null
  >;
  frameName: string;
  isFocused: boolean;
  onFocus: () => void;
  onShapeSelect: (sequenceId: ShapeSequenceId) => void;
}
function FrameColumn(props: FrameColumnProps) {
  return (
    <>
      <div
        style={{
          gridColumn: props.columnIndex + 1,
          gridRow: 1,
        }}
      >
        <button
          onClick={props.onFocus}
          style={{
            fontWeight: props.isFocused ? "bold" : "normal",
          }}
        >
          {props.frameName}
        </button>
      </div>
      <div
        style={{
          gridColumn: props.columnIndex + 1,
          gridRow: 2,
        }}
      >
        {props.stepContents[CAMERA_SEQUENCE_ID]?.text}
      </div>
      {props.shapeSequenceIds.map((sequenceId, sequenceIdx) => {
        const stepContent = props.stepContents[sequenceId];
        return (
          <div
            key={sequenceId}
            style={{
              gridColumn: props.columnIndex + 1,
              gridRow: sequenceIdx + 3,
            }}
          >
            {stepContent && (
              <button onClick={() => props.onShapeSelect(sequenceId)}>
                {stepContent.text}
                {stepContent.isSelected ? " *" : ""}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

export const FramePanel = track(() => {
  const editor = useEditor();

  const frames = $presentationFlow.getFrames();
  const currentFrameIndex = $currentFrameIndex.get();

  const shapeSequenceIds = Object.keys(
    $presentationFlow.state.sequences
  ).filter((sid) => sid !== CAMERA_SEQUENCE_ID) as ShapeSequenceId[];

  const selectedSteps = editor
    .getSelectedShapes()
    .map((shape) => {
      const animeMeta = getAnimeMeta(shape);
      if (animeMeta == null || animeMeta.type !== "edit") {
        return null;
      }
      return {
        sequenceId: animeMeta.sequenceId,
        index: animeMeta.index,
      };
    })
    .filter(
      (
        step
      ): step is { sequenceId: ShapeSequenceId; index: number | "initial" } =>
        step != null
    );
  const isSelected = (sequenceId: SequenceId, index: number | "initial") =>
    selectedSteps.some(
      (step) => step.sequenceId === sequenceId && step.index === index
    );

  return (
    <div
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${frames.length + 2}, 1fr)`,
          gridTemplateRows: `repeat(${shapeSequenceIds.length + 2}, 1fr)`,
        }}
      >
        <FrameColumn
          columnIndex={0}
          frameName="Initial state"
          shapeSequenceIds={shapeSequenceIds}
          isFocused={currentFrameIndex === "initial"}
          stepContents={{
            [CAMERA_SEQUENCE_ID]: null,
            ...Object.fromEntries(
              shapeSequenceIds.map((sequenceId) => [
                sequenceId,
                { text: "s", isSelected: isSelected(sequenceId, "initial") },
              ])
            ),
          }}
          onFocus={() => {
            $currentFrameIndex.set("initial");
            runInitialFrame(editor);
          }}
          onShapeSelect={(sequenceId) => {
            editor.getCurrentPageShapes().forEach((shape) => {
              const animeMeta = getAnimeMeta(shape);
              if (
                animeMeta &&
                animeMeta.sequenceId === sequenceId &&
                animeMeta.index === "initial" &&
                animeMeta.type === "edit"
              ) {
                editor.select(shape.id);
              }
            });
          }}
        />
        {frames.map((frame, frameIdx) => (
          <FrameColumn
            key={frameIdx}
            frameName={`Frame ${frameIdx + 1}`}
            columnIndex={frameIdx + 1}
            shapeSequenceIds={shapeSequenceIds}
            isFocused={frameIdx === currentFrameIndex}
            stepContents={{
              [CAMERA_SEQUENCE_ID]:
                frame[CAMERA_SEQUENCE_ID].type === "at"
                  ? {
                      text: "C",
                      isSelected: isSelected(
                        CAMERA_SEQUENCE_ID,
                        frame[CAMERA_SEQUENCE_ID].index
                      ),
                    }
                  : null,
              ...Object.fromEntries(
                shapeSequenceIds.map((sequenceId) => [
                  sequenceId,
                  frame[sequenceId]?.type === "at"
                    ? {
                        text: `${frame[sequenceId].index + 1}`,
                        isSelected: isSelected(
                          sequenceId,
                          frame[sequenceId].index
                        ),
                      }
                    : null,
                ])
              ),
            }}
            onFocus={() => {
              $currentFrameIndex.set(frameIdx);
              runFrame(editor, frame, { skipAnime: true });
            }}
            onShapeSelect={(sequenceId) => {
              editor.getCurrentPageShapes().forEach((shape) => {
                const animeMeta = getAnimeMeta(shape);
                if (
                  animeMeta &&
                  animeMeta.sequenceId === sequenceId &&
                  animeMeta.index === frame[sequenceId]?.index &&
                  animeMeta.type === "edit"
                ) {
                  editor.select(shape.id);
                }
              });
            }}
          />
        ))}
      </div>

      <div>
        <button
          onClick={() => {
            const selectedShapes = editor
              .getSelectedShapes()
              .filter(
                (shape) =>
                  shape.type !== SlideShapeType && getAnimeMeta(shape) == null
              );
            selectedShapes.forEach((shape) => {
              $presentationFlow.addShapeSequence(shape);
            });
            editor.deleteShapes(selectedShapes);
          }}
        >
          Animate the selected shape
        </button>
        <button
          onClick={() => {
            const selectedShapes = editor.getSelectedShapes();
            selectedShapes.forEach((shape) => {
              const animeMeta = getAnimeMeta(shape);
              if (animeMeta == null) {
                console.warn("Shape is not animated");
                return;
              }

              const newShape = { ...shape, x: shape.x + 100, y: shape.y + 100 };
              $presentationFlow.pushStep(animeMeta.sequenceId, {
                type: "shape",
                shape: newShape,
                animateShapeOpts: {
                  animation: {
                    duration: 1000,
                  },
                },
              });
            });
          }}
        >
          Add new animation to the selected shape
        </button>
        <button
          onClick={() => {
            const selectedSlideShapes = editor
              .getSelectedShapes()
              .filter((shape) => shape.type === SlideShapeType);
            selectedSlideShapes.forEach((slideShape) => {
              $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
                type: "camera",
                shapeId: slideShape.id,
                zoomToBoundsParams: {
                  animation: {
                    duration: 1000,
                  },
                },
              });
            });
          }}
        >
          Add the selected slide as a new frame
        </button>
        <label>
          Presentation mode
          <input
            type="checkbox"
            checked={$presentationMode.get()}
            onChange={(e) => {
              $presentationMode.set(e.target.checked);
              if (currentFrameIndex === "initial") {
                runInitialFrame(editor);
              } else {
                runFrame(editor, frames[currentFrameIndex]);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
});
