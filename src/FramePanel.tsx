import { track, useEditor, stopEventPropagation } from "tldraw";
import {
  $currentFrameIndex,
  $presentationMode,
  AnimeDataMeta,
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
  frameName: string;
  isFocused: boolean;
  onClick: () => void;
  stepLabel: (sequenceId: SequenceId) => string;
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
          onClick={props.onClick}
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
        {props.stepLabel(CAMERA_SEQUENCE_ID)}
      </div>
      {props.shapeSequenceIds.map((sequenceId, sequenceIdx) => {
        return (
          <div
            key={sequenceId}
            style={{
              gridColumn: props.columnIndex + 1,
              gridRow: sequenceIdx + 3,
            }}
          >
            {props.stepLabel(sequenceId)}
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
          stepLabel={() => "*"}
          onClick={() => {
            $currentFrameIndex.set("initial");
            runInitialFrame(editor);
          }}
        />
        {frames.map((frame, frameIdx) => (
          <FrameColumn
            key={frameIdx}
            frameName={`Frame ${frameIdx + 1}`}
            columnIndex={frameIdx + 1}
            shapeSequenceIds={shapeSequenceIds}
            isFocused={frameIdx === currentFrameIndex}
            stepLabel={(sequenceId) => {
              const stepIndex = frame[sequenceId];
              return stepIndex?.type === "at" ? `${stepIndex.index + 1}` : "-";
            }}
            onClick={() => {
              $currentFrameIndex.set(frameIdx);
              runFrame(editor, frame, { skipAnime: true });
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
                  shape.type !== SlideShapeType && shape.meta?.anime == null
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
              const animeMeta = shape.meta?.anime as
                | AnimeDataMeta["anime"]
                | undefined;
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
