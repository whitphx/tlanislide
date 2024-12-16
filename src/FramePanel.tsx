import { track, useEditor, stopEventPropagation } from "tldraw";
import {
  $currentFrameIndex,
  $presentationMode,
  AnimeDataMeta,
  runInitialFrame,
} from "./frame";
import { $presentationFlow, runFrame } from "./frame";
import { SlideShapeType } from "./SlideShapeUtil";
import { CAMERA_SEQUENCE_ID, ShapeSequenceId } from "./presentation-flow";

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
        <>
          <div
            style={{
              gridColumn: 1,
              gridRow: 1,
            }}
          >
            <button
              onClick={() => {
                $currentFrameIndex.set("initial");
                runInitialFrame(editor);
              }}
              style={{
                fontWeight: currentFrameIndex === "initial" ? "bold" : "normal",
              }}
            >
              Initial state
            </button>
          </div>
          <div
            style={{
              gridColumn: 1,
              gridRow: 2,
            }}
          >
            c
          </div>
          {shapeSequenceIds.map((sequenceId, sequenceIdx) => {
            return (
              <div
                style={{
                  gridColumn: 1,
                  gridRow: sequenceIdx + 3,
                }}
              >
                s
              </div>
            );
          })}
        </>
        {frames.map((frame, frameIdx) => {
          const isCurrentFrame = frameIdx === currentFrameIndex;
          const cameraStepExists = frame[CAMERA_SEQUENCE_ID].type === "at";
          return (
            <>
              <div
                style={{
                  gridColumn: frameIdx + 2,
                  gridRow: 1,
                }}
              >
                <button
                  onClick={() => {
                    $currentFrameIndex.set(frameIdx);
                    runFrame(editor, frame, { skipAnime: true });
                  }}
                  style={{
                    fontWeight: isCurrentFrame ? "bold" : "normal",
                  }}
                >
                  Frame {frameIdx + 1}
                </button>
              </div>
              <div
                style={{
                  gridColumn: frameIdx + 2,
                  gridRow: 2,
                }}
              >
                {cameraStepExists ? "c" : "-"}
              </div>
              {shapeSequenceIds.map((sequenceId, sequenceIdx) => {
                const key = `${frameIdx}-${sequenceId}`;
                const shapeStepExists = frame[sequenceId].type === "at";
                return (
                  <div
                    key={key}
                    style={{
                      gridColumn: frameIdx + 2,
                      gridRow: sequenceIdx + 3,
                    }}
                  >
                    {shapeStepExists ? "s" : "-"}
                  </div>
                );
              })}
            </>
          );
        })}
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
